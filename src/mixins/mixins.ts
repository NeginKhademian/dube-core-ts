import {
  get as objGet,
  set as objSet,
  forEach,
  isNil,
  isArray,
  isString,
  isFunction,
  flatMapDeep,
} from "lodash";

import { ISchema, IModel, TField } from "../interfaces";

export default {
  methods: {
    templateEngineConverter(model: IModel, template: string, values: string) {
      const _regex = /{{.*?}}/g;
      return template.replace(_regex, (match) => {
        const matchedValue = match.replace(/\{|\}/g, "");
        const splittedProperty = matchedValue?.split("||");
        if (splittedProperty?.length) {
          let res = objGet(model, splittedProperty?.[0]?.trim());
          if (typeof res !== "undefined") {
            return res;
          } else if (splittedProperty?.[1]?.trim()) {
            return splittedProperty?.[1]?.trim();
          } else if (values?.length) {
            res = objGet(values, splittedProperty?.[0]?.trim());
            if (res) return res;
          }
          return template;
        }
      });
    },
    getDataFromModel(model: IModel, property: any, values: any, dfb: any) {
      const _regex = /{{.*?}}/g;
      if (_regex.test(property)) {
        return this.templateEngineConverter(model, property, values);
      } else {
        if (typeof property !== "undefined") {
          let result: any;
          const propertyType = this.getType(property);
          if (propertyType === "Object") {
            result = {};
            Object.entries(property).forEach(([key, value]) => {
              const newVal = this.getDataFromModel(model, value, values, dfb);
              result[key] = newVal;
            });
            return result;
          } else if (propertyType === "Array") {
            result = [];
            property.forEach((x: any) => {
              result.push(this.getDataFromModel(model, x, values, dfb));
            });
            return result;
          }
          return property;
        }
        return property;
      }
    },
    getConfigServiceByName(configName: string) {
      return this.$store.getters["getConfigServiceByName"](configName);
    },
    /**
     * @description This mixin function helps to replace the hard-coded values of lookupfields
     *              with the data list which comes from server side
     * @param {Object} formSchema
     * @param {Object} formModel
     * @returns new converted schema
     */
    async schemaConverter(formSchema: ISchema, formModel: IModel) {
      const schema = { ...formSchema };
      const model = { ...formModel };
      if (!schema?.lookupFieldsList?.length) return;

      // re-check if configs list were not recieved correctly,
      const getAllConfigServices = this.$store.getters["getAllConfigServices"];
      if (!getAllConfigServices?.length) {
        // and one more time try to send new request to get the config list
        await this.$store.dispatch("setAllConfigs");
      }
      schema.lookupFieldsList.forEach((x) => {
        // check schema.lookupFieldsList[] and get them through 'findFieldByModel()' from schema.fields[]
        const foundField = this.findFieldByModel(schema, x.fieldId);
        if (foundField) {
          const currentFieldValues = this.getConfigServiceByName(
            x.lookupAlterName || foundField.fieldId
          );
          if (currentFieldValues?.members?.members) {
            if (x.setModel && x.fieldPath) {
              objSet(
                model,
                x.fieldPath,
                x.lookupPath
                  ? objGet(currentFieldValues, x.lookupPath)
                  : currentFieldValues.members.members
              );
            } else {
              if (x.lookupPath) {
                if (this.getType(foundField[x.lookupProperty]) === "String") {
                  this.$set(
                    foundField,
                    x.lookupProperty,
                    objGet(currentFieldValues, x.lookupPath)
                  );
                } else {
                  foundField[x.lookupProperty] = objGet(
                    currentFieldValues,
                    x.lookupPath
                  );
                }
              } else {
                foundField[x.lookupProperty] =
                  currentFieldValues.members.members;
              }
            }
          }
        }
      });
      return {
        schema,
        model,
      };
    },
    /**
     * @description Contains couple of useful functions to return the from's error
     * @param {Object} context
     *
     */
    ValidationHandler(context: any) {
      const result: any = [];
      const vm = context;
      this.checkValidation = function (
        collection: any | any[],
        includeValue: boolean = false
      ) {
        let isValid;
        try {
          isValid = collection.validate();
        } catch (ex) {
          isValid = null;
        }
        let newObj = {
          id: collection?.schema?.fieldId || collection?.schema?.id,
          field: collection?.schema || {},
          validationStatus: isValid,
          value: null,
        };
        if (includeValue) {
          newObj = {
            ...newObj,
            value: collection?.value,
          };
        }
        if (newObj.id) {
          result.push(newObj);
        }
        if (collection?.$children?.length) {
          this.checkStatus(collection.$children, includeValue);
        }
      };
      this.checkStatus = function (
        collection: any | any[],
        includeValue: boolean = false
      ) {
        if (Array.isArray(collection)) {
          collection.forEach((col) => {
            this.checkValidation(col, includeValue);
          });
        } else {
          this.checkValidation(collection, includeValue);
        }
        return this;
      };
      this.getRawResult = function () {
        return result;
      };
      this.getCollectionRawErrors = function (fromCollection: any | any[]) {
        const self = vm;
        if (result?.length) {
          const currentCollectionStatus = result.map((r: any) => {
            const foundField = self.findFieldByModel(fromCollection, r.id);
            if (foundField) {
              return r;
            }
          });
          return currentCollectionStatus.filter((x: any) => x);
        }
      };
      this.getCollectionErrors = function (rawCollection = result) {
        if (rawCollection?.length) {
          const collection = rawCollection.map((rc: any) => {
            if (rc?.validationStatus?.length) {
              return {
                id: rc.id,
                label: rc.field?.label || rc.field?.title || "",
                errors: rc.validationStatus,
              };
            }
          });
          return collection.filter((x: any) => x?.id);
        }
      };
    },
    /**
     *
     * @param {Object} collection
     * @param {String} property
     * @param {Any} value
     * @param {String} childrenKeyName
     * @returns
     */
    modifyPropertyInCollection(
      collection: any | any[],
      property: string,
      value: any,
      childrenKeyName: string = "fields"
    ) {
      if (!collection || !property) return;
      if (Array.isArray(collection)) {
        let counter = 0;
        while (counter < collection.length) {
          this.modifyPropertyInCollection(
            collection[counter],
            property,
            value,
            childrenKeyName
          );
          counter++;
        }
      } else {
        if (Object.prototype.hasOwnProperty.call(collection, property)) {
          collection[property] = value;
        } else {
          this.$set(collection, property, value);
        }
        if (collection[childrenKeyName]?.length) {
          this.modifyPropertyInCollection(
            collection[childrenKeyName],
            property,
            value,
            childrenKeyName
          );
        }
      }
      return collection;
    },
    /**
     *
     * @param {Array} a
     * @param {Array} b
     * @returns the common elements between 2 arrays
     */
    intersect(a: any[], b: any[]) {
      return a.filter(Set.prototype.has, new Set(b));
    },
    /**
     * @description This function converts the raw value of each fields of Form-Engine to a new form
     *              which is appropriate for showing them in read-only (summary) page
     * @param {Object} field
     * @param {Any} value
     * @returns new converted value
     */
    readOnlyHandler(field: TField, value: any) {
      if (!field) return;
      let result;
      const valueType = this.getType(value);

      switch (field.type) {
        case "vSelect":
        case "vAutoComplete": {
          if (valueType === "Array") {
            // if field.multiple === true
            result = value.map((v: any) => {
              const vType = this.getType(v);
              if (
                vType === "String" ||
                vType === "Number" ||
                vType === "Boolean"
              ) {
                // if field.multiple === true AND field.retrunObject === false
                const foundVal = field?.values?.find(
                  (x: any) => x[field.itemValue || "id"] === v
                );
                if (foundVal) {
                  return foundVal[field.itemText || "name"];
                }
              } else if (vType === "Object") {
                // if field.multiple === true AND field.retrunObject === true
                return v[field.itemText || "name"];
              }
            });
          } else if (
            valueType === "String" ||
            valueType === "Number" ||
            valueType === "Boolean"
          ) {
            // if field.multiple === false AND field.retrunObject === false
            const val = field?.values?.find(
              (v: any) => v[field.itemValue || "id"] === value
            );
            if (val) {
              result = val[field.itemText || "name"];
            } else {
              result = value;
            }
          } else if (valueType === "Object") {
            // if field.multiple === false AND field.retrunObject === true
            result = value[field.itemText || "name"];
          } else {
            result = "";
          }
          break;
        }
        case "vTextbox": {
          result = value;
          break;
        }
      }
      return result;
    },
    /**
     * @description A useful function to get back the type of any variable,
     *              the type names it supports are: String - Number - BigInt - Boolean - Object - Array - Function - Symbol
     * @param {Any} data
     * @param {Boolean} debug
     * @returns type of 'data'
     */
    getType(data: any, debug: boolean = false) {
      const log = console.log;
      let result: string = ``;
      const typeString = Object.prototype.toString.call(data);
      result = typeString.replace(/\[object /gi, ``).replace(/\]/gi, ``);
      if (debug) {
        log(`true type`, result);
      }
      return result;
    },
    flattenDeep(collection: any) {
      const getMembers: any = (member: any) => {
        if (!member.fields || !member.fields.length) {
          return member;
        }
        return [member, flatMapDeep(member.fields, getMembers)];
      };

      return flatMapDeep(collection, getMembers);
    },
    findFieldByModel(
      collection: any,
      model: string,
      property: string = "fieldId"
    ) {
      let found;
      if (Array.isArray(collection)) {
        found = collection.find((d) => d[property] === model);
      } else if (typeof collection === "object") {
        found = collection[property] === model ? collection : undefined;
      }
      if (!found) {
        if (Array.isArray(collection)) {
          let i = 0;
          while (!found && i < collection.length) {
            found = this.findFieldByModel(
              collection[i].fields,
              model,
              property
            );
            i++;
          }
        } else if (typeof collection === "object") {
          if (collection?.fields?.length) {
            found = this.findFieldByModel(collection.fields, model, property);
          }
        }
      }
      return found;
    }, //end recursiveSearchFieldByModel
    // Get style classes of field
    getFieldRowClasses(field: any, isSummaryMode: boolean = false) {
      const hasErrors = this.fieldErrors(field).length > 0;
      const baseClasses = {
        [objGet(this.options, "validationErrorClass", "error")]: hasErrors,
        [objGet(this.options, "validationSuccessClass", "valid")]: !hasErrors,
        disabled: this.fieldDisabled(field),
        readonly: this.fieldReadonly(field),
        featured: this.fieldFeatured(field),
        required: this.fieldRequired(field),
      };
      if (isSummaryMode && field.summaryStyleClasses) {
        if (isArray(field.summaryStyleClasses)) {
          forEach(field.summaryStyleClasses, (c) => (baseClasses[c] = true));
        } else if (isString(field.summaryStyleClasses)) {
          baseClasses[field.summaryStyleClasses as keyof typeof baseClasses] =
            true;
        }
      } else {
        if (isArray(field.styleClasses)) {
          forEach(field.styleClasses, (c) => (baseClasses[c] = true));
        } else if (isString(field.styleClasses)) {
          baseClasses[field.styleClasses as keyof typeof baseClasses] = true;
        }
      }

      if (!isNil(field.type)) {
        baseClasses[("field-" + field.type) as keyof typeof baseClasses] = true;
      }

      return baseClasses;
    },
    fieldErrors(field: TField) {
      const res = this.errors.filter((e: any) => e.field === field);
      return res.map((item: any) => item.error);
    },
    // Get disabled attr of field
    fieldDisabled(field: TField) {
      if (isFunction(field.disabled))
        return field.disabled.call(this, this.model, field, this);

      if (isNil(field.disabled)) return false;

      return field.disabled;
    },
    // Get readonly prop of field
    fieldReadonly(field: TField) {
      if (isFunction(field.readonly))
        return field.readonly.call(this, this.model, field, this);

      if (isNil(field.readonly)) return false;

      return field.readonly;
    },
    // Get featured prop of field
    fieldFeatured(field: TField) {
      if (isFunction(field.featured))
        return field.featured.call(this, this.model, field, this);

      if (isNil(field.featured)) return false;

      return field.featured;
    },
    // Get required prop of field
    fieldRequired(field: TField) {
      if (isFunction(field.required))
        return field.required.call(this, this.model, field, this);

      if (isNil(field.required)) return false;

      return field.required;
    },
    generateID(length: number) {
      let result = "";
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      const charactersLength = characters.length;
      for (let i = 0; i < length; i++) {
        result += characters.charAt(
          Math.floor(Math.random() * charactersLength)
        );
      }
      return result;
    }, //end generateID
    CSSNormalizer(classes: string, parentClass: string) {
      if (!classes || !parentClass) return;
      try {
        const _classes = classes.split("}");
        if (_classes?.length) {
          const newClassesArr: string[] = _classes.map((x) => {
            if (x.trim()) {
              return `${parentClass} ${x}}`;
            }
            return "";
          });
          const _newClassesArr: string = newClassesArr.join();
          const regex = new RegExp(",", "g");
          return `<style>${_newClassesArr.replace(regex, "")}</style>`;
        }
        return "";
      } catch (ex) {
        return "";
      }
    },
    /**
     *
     * @param {Object} schema
     * @param {String} fieldId
     * @param {Object} attrs
     */
    setNewPropsToField(schema: ISchema, fieldId: string = "", attrs: any = {}) {
      let vm = this;

      let foundField = vm.findFieldByModel(schema, fieldId);
      if (foundField) {
        if (attrs && Object.keys(attrs).length) {
          let _field = {
            ...foundField,
            ...attrs,
          };
          Object.entries(_field).forEach(([key, value]) => {
            vm.$set(foundField, key, value);
          });
        }
      }
    },
  },
};
