import express from "express";
import { configureHttpApp } from "./src/server/app.js";

export default configureHttpApp(express());
