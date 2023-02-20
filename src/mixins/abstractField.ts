import {
  get as objGet,
  isNil,
  forEach,
  isFunction,
  isString,
  isArray,
  debounce,
  uniqueId,
  uniq as arrayUniq,
} from "lodash";
import validators from "../utils/validators";
import { slugifyFormID } from "../utils/schema";

import { IProps, TField } from "../interfaces";

function convertValidator(validator: any) {
  if (isString(validator)) {
    if (validators[validator as keyof typeof validators] !== null)
      return validators[validator as keyof typeof validators];
    else {
      console.warn(`'${validator}' is not a validator function!`);
      return null; // caller need to handle null
    }
  }
  return validator;
}

function attributesDirective(el: any, binding: any, vNode: any) {
  let attrs = objGet(vNode.context, "schema.attributes", {});
  const container = binding.value || "input";
  if (isString(container)) {
    attrs = objGet(attrs, container) || attrs;
  }
  forEach(attrs, (val: any, key: any) => {
    el.setAttribute(key, val);
  });
}

const props = defineProps<IProps>();
export default {
  // props: [
  //   "dfb",
  //   "model",
  //   "schema",
  //   "formOptions",
  //   "disabled",
  //   "validationStatus",
  //   "isSubForm",
  //   "submit",
  // ],
  props,
  data() {
    return {
      errors: [],
      debouncedValidateFunc: null,
      debouncedFormatFunc: null,
    };
  },

  directives: {
    attributes: {
      bind: attributesDirective,
      updated: attributesDirective,
      componentUpdated: attributesDirective,
    },
  },

  computed: {
    value: {
      cache: false,
      get() {
        const self = this;
        let val;
        if (isFunction(objGet(self.schema, "get"))) {
          val = self.schema.get(self.model);
        } else {
          val = objGet(self.model, self.schema.model);
        }

        return self.formatValueToField(val);
      },

      set(newValue: any) {
        const self = this;
        const oldValue = self.value;
        newValue = self.formatValueToModel(newValue);

        if (isFunction(newValue)) {
          newValue(newValue, oldValue);
        } else {
          self.updateModelValue(newValue, oldValue);
        }
      },
    },
  },

  methods: {
    fieldFunctionHandler(field: TField, objectKey: string, args = {}) {
      const self = this;
      try {
        if (isFunction(field?.[objectKey]))
          return field?.[objectKey].call(
            self,
            self.model,
            field,
            self.schema,
            self,
            args
          );

        if (isNil(field?.[objectKey])) return true;

        return field?.[objectKey];
      } catch (ex) {
        return field?.[objectKey] || "";
      }
    },
    validate(calledParent: any) {
      const self = this;
      self.clearValidationErrors();
      const validateAsync = objGet(self.formOptions, "validateAsync", false);

      let results: any[] = [];

      if (self.schema.disableValidator === true) {
        return results;
      }

      if (
        self.schema.validator &&
        self.schema.readonly !== true &&
        self.disabled !== true
      ) {
        const validators: any[] = [];
        if (!isArray(self.schema.validator)) {
          validators.push(convertValidator(self.schema.validator).bind(self));
        } else {
          forEach(self.schema.validator, (validator: any) => {
            validators.push(convertValidator(validator).bind(self));
          });
        }

        forEach(validators, (validator: any) => {
          if (validateAsync) {
            results.push(validator(self.value, self.schema, self.model));
          } else {
            const result = validator(self.value, self.schema, self.model);
            if (result && isFunction(result.then)) {
              result.then((err: any) => {
                if (err) {
                  self.errors = self.errors.concat(err);
                }
                const isValid = self.errors.length === 0;
                self.$emit("validated", isValid, self.errors, self);
              });
            } else if (result) {
              results = results.concat(result);
            }
          }
        });
      }

      const handleErrors = (errors: any) => {
        let fieldErrors: any[] = [];
        forEach(arrayUniq(errors), (err: any) => {
          if (isArray(err) && err.length > 0) {
            fieldErrors = fieldErrors.concat(err);
          } else if (isString(err)) {
            fieldErrors.push(err);
          }
        });
        if (isFunction(this.schema.onValidated)) {
          this.schema.onValidated.call(
            this,
            this.model,
            fieldErrors,
            this.schema
          );
        }

        const isValid = fieldErrors.length === 0;
        if (!calledParent) {
          this.$emit("validated", isValid, fieldErrors, this);
        }
        this.errors = fieldErrors;
        return fieldErrors;
      };
      if (!validateAsync) {
        return handleErrors(results);
      }

      return Promise.all(results).then(handleErrors);
    },

    debouncedValidate() {
      const self = this;
      if (!isFunction(self.debouncedValidateFunc)) {
        self.debouncedValidateFunc = debounce(
          self.validate.bind(self),
          objGet(
            self.schema,
            "validateDebounceTime",
            objGet(self.formOptions, "validateDebounceTime", 500)
          )
        );
      }
      self.debouncedValidateFunc();
    },

    updateModelValue(newValue: any, oldValue: any) {
      const self = this;
      let changed = false;
      if (isFunction(self.schema.set)) {
        self.schema.set(self.model, newValue);
        changed = true;
      } else if (self.schema.model) {
        self.setModelValueByPath(self.schema.model, newValue);
        changed = true;
      }

      if (changed) {
        self.$emit("model-updated", newValue, self.schema.model);

        if (isFunction(self.schema.onChanged)) {
          self.schema.onChanged.call(
            self,
            self.model,
            newValue,
            oldValue,
            self.schema
          );
        }

        if (objGet(self.formOptions, "validateAfterChanged", false) === true) {
          if (
            objGet(
              self.schema,
              "validateDebounceTime",
              objGet(self.formOptions, "validateDebounceTime", 0)
            ) > 0
          ) {
            self.debouncedValidate();
          } else {
            self.validate();
          }
        }
      }
    },

    clearValidationErrors() {
      this.errors.splice(0);
    },

    setModelValueByPath(path: string, value: any) {
      const self = this;
      // convert array indexes to properties
      let s = path.replace(/\[(\w+)\]/g, ".$1");

      // strip a leading dot
      s = s.replace(/^\./, "");

      let o = self.model;
      const a = s.split(".");
      let i = 0;
      const n = a.length;
      while (i < n) {
        const k = a[i];
        if (i < n - 1)
          if (o[k] !== undefined) {
            // Found parent property. Step in
            o = o[k];
          } else {
            // Create missing property (new level)
            self.$root.$set(o, k, {});
            o = o[k];
          }
        else {
          // Set final property value
          self.$root.$set(o, k, value);
          return;
        }

        ++i;
      }
    },

    getFieldID(schema: TField, unique = false) {
      const self = this;
      const idPrefix = objGet(self.formOptions, "fieldIdPrefix", "");
      return slugifyFormID(schema, idPrefix) + (unique ? "-" + uniqueId() : "");
    },

    getFieldClasses() {
      const self = this;
      return objGet(self.schema, "fieldClasses", []);
    },

    formatValueToField(value: any) {
      return value;
    },

    formatValueToModel(value: any) {
      return value;
    },
  },
};
