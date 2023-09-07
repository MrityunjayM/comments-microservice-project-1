import express from "express";
import cors from "cors";
import { randomBytes } from "node:crypto";
import axios from "axios";

const app = express();

// initialize middleware('s)
app.use(express.json());
app.use(cors());

// datastore
const comments = {};

function getRandomId(bytes = 4) {
  return randomBytes(bytes).toString("hex");
}

// define GET route for /posts - retrive all posts
app.get("/posts/:postId/comments", (req, res) => {
  const { postId } = req.params;
  return res.json(comments[postId] || []);
});

// define POST route for /posts - create a new post
app.post("/posts/:postId/comments", (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;
  // get a random id for new post
  const commentId = getRandomId();
  const _comment = { id: commentId, comment: comment, status: "pending" };

  // store the post in datastore
  const _comments = comments[postId] || [];
  _comments.push(_comment);

  comments[postId] = _comments;

  // send CommentCreated event to event_bus
  axios
    .post("http://event-bus-srv:4010/events", {
      type: "CommentCreated",
      data: { postId, ..._comment },
    })
    .catch(console.error);

  // return post object in response
  return res.status(201).json(_comments);
});

app.post("/events", (req, res) => {
  const { type, data } = req.body;

  if (type === "CommentModerated") {
    // find comment from the comments array of the post with the postId of the comment
    const _comments = comments[data.postId];
    const _comment = _comments.find(({ id }) => id === data.id);

    // update comment's status to approved or rejected, from moderated event data
    _comment.status = data.status;

    // send CommentUpdated event to event_bus
    axios
      .post("http://event-bus-srv:4010/events", {
        type: "CommentUpdated",
        data: { ..._comment, postId: data.postId },
      })
      .catch(console.error);
  }

  return res.sendStatus(204);
});

const PORT = process.env.PORT || 4012;

app.listen(PORT, () => {
  console.info("[COMMENTS SERVICE]: running on port %d", PORT);
});
