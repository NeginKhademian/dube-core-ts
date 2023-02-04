import { App } from "vue";
import * as components from "./components";
import { vuetify } from "./plugins";

function install(app: App) {
  for (const key in components) {
    // @ts-expect-error
    app.component(key, components[key]);
  }
  app.use(vuetify);
}

import "./assets/main.scss";

export default { install };

export * from "./components";
export * from "./constants";
export * from "./plugins";
export * from "./utils";
