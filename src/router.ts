import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Board from "./views/Board.vue";
import NotFound from "./views/NotFound.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/b/:id", name: "board", component: Board, props: true },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound },
  ],
});

router.afterEach((to) => {
  if (to.name === "home") {
    document.title = "Fast Kanban";
  } else if (to.name === "not-found") {
    document.title = "Not Found - Fast Kanban";
  }
});
