import { get as objGet } from "lodash";
import { TField, IModel } from "../interfaces";
import mixins from "../mixins/mixins";
export default {
  mixins: [mixins],
  data() {
    return {
      formValidationStatus: [],
    };
  },
  methods: {
    isFieldValid(field: TField, value: any) {
      if (field?.validator?.length) {
        if (Array.isArray(field.validator)) {
          const result = field.validator.map((r) => {
            return r.call(this, value);
          });
          return result.filter((x) => x !== true);
        }
      }
      return true;
    }, //end isFieldValid
    checkFieldsValidation(fields: TField[], model: IModel) {
      if (!fields || !model) return;
      const flattenFields = this.flattenDeep(fields);
      const filteredFieldsByValidator = flattenFields.filter(
        (f: TField) => f.validator
      );

      const validationStatus = filteredFieldsByValidator.map(
        (field: TField) => {
          const normalizedFieldObject = {
            fields: [...fields],
          };
          const parents = this.getPath(normalizedFieldObject, field.fieldId);
          const parentsKeys = parents
            .filter((x: any) => x.id)
            .map((x: any) => x.id);
          const fieldPath = parentsKeys.join(".");

          const value = objGet(model, fieldPath);
          let currentFieldValidationStatus = this.isFieldValid(field, value);
          if (field.disableValidator === true) {
            currentFieldValidationStatus = [];
          }
          return {
            id: field.fieldId,
            model: field.model,
            label: field.label,
            validationStatus: currentFieldValidationStatus,
          };
        }
      );
      return validationStatus;
    }, //end checkFieldsValidation
    getPath(object: any, key: string, property: string = "model") {
      let path;
      const item = {
        id: object[property],
      };

      if (!object || typeof object !== "object") return;

      if (object[property] === key) return [item];

      (object.fields || []).some(
        (child: any) => (path = this.getPath(child, key, property))
      );
      return path && [item, ...path];
    }, //end getPath
  },
};
