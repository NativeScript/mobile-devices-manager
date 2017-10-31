import { Schema } from "mongoose";

export var device: Schema = new Schema({
  name: String,
  token: String,
  type: String,
  platform: String,
  status: String,
  info: String,
  config: {},
  startedAt: Number,
  busySince: Number,
  pid: Number,
  apiLevel: String
});

device.pre("save", function (next) {
  next();
});

export var user: Schema = new Schema({
    createdAt: Date,
    email: String,
    name: String,
    lastName: String
  });
  
  user.pre("save", function(next) {
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
    next();
  });