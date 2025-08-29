import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    user: { type: String, required: true },
    socketId: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
