import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Board from "./views/Board.vue";
import NotFound from "./views/NotFound.vue";
import { i18n } from "./i18n";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    { path: "/b/:id/:cardSlug?", name: "board", component: Board, props: true },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound },
  ],
});

// The brand name is the same in every locale; only the 404 page title changes.
function applyTitle(name: unknown) {
  document.title =
    name === "not-found" ? `${i18n.global.t("common.notFoundPageTitle")} - Fast Kanban` : "Fast Kanban";
}

router.afterEach((to) => {
  applyTitle(to.name);
});

// Keep the tab title in sync when the language switches without a navigation.
watch(i18n.global.locale, () => applyTitle(router.currentRoute.value.name));
