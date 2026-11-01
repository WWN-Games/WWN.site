import "../../src/styles/style.css";
import "./app.css";
import { mount } from "svelte";

import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("Не найден #app");

const app = mount(App, { target });

export default app;
