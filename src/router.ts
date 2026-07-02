import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Board from "./views/Board.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/b/:id", name: "board", component: Board, props: true },
  ],
});
