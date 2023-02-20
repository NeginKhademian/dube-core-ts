// const forEach = require('lodash').forEach;
import { forEach } from "lodash";

const fieldComponents: any = {};

const coreFields = require.context(
  "../components",
  false,
  /^\.\/field([\w-_]+)\.vue$/
);

forEach(coreFields.keys(), (key) => {
  const compName: string = key.replace(/^\.\//, "").replace(/\.vue/, "");
  fieldComponents[compName as keyof typeof fieldComponents] =
    coreFields(key).default;
});

if (process.env.FULL_BUNDLE) {
  const optionalFields = require.context(
    "../components",
    false,
    /^\.\/field([\w-_]+)\.vue$/
  );

  forEach(optionalFields.keys(), (key) => {
    const compName = key.replace(/^\.\//, "").replace(/\.vue/, "");
    fieldComponents[compName] = optionalFields(key).default;
  });
}

export default fieldComponents;
