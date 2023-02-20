<script lang="ts">
import { get as objGet, isNil, isFunction, isEqual } from "lodash";
import { slugifyFormID } from "../utils/schema";
import mixins from "../mixins/mixins";
import fieldComponents from "../utils/fieldsLoader";
import validation from "../utils/validation";
import { TField } from "../interfaces";
// import { IModel, TField } from "../interfaces";

export default {
  name: "fieldContainer",
  components: { fieldComponents },
  mixins: [mixins, validation],
  props: {
    dfb: {
      type: Object,
    },
    model: Object,
    options: {
      type: Object,
    },
    field: {
      type: Object,
      required: true,
    },
    errors: {
      type: Array,
      default() {
        return [];
      },
    },
    validationStatus: Array,
    isSubForm: Boolean,
    submit: Function,
  },
  data() {
    return {
      isFieldTouched: 0,
      counter: 1,
      validatorConverted: false,
      deniedLabels: [
        "label",
        "duplicableForm",
        "divContainer",
        "card",
        "vDivider",
        "vSubHeader",
        "switch",
        "fileupload",
      ],
    };
  },
  mounted() {
    this.convertValidatorToFunction();
  },
  computed: {
    fieldSchema() {
      let vm = this;
      let field = vm.field;

      return field; //this.getDataFromModel(this.model, this.field, this.field.values || this.field.defaultValue || [], this.dfb)
    },
    currentFieldValidationCalled() {
      if (this.field.disableValidator === true) return "";
      if (this.validationStatus?.length) {
        let isFieldInvalid = this.validationStatus.find(
          (x: any) => x.id === this.field.fieldId
        );
        if (isFieldInvalid) {
          return isFieldInvalid;
        }
      }
      return "";
    },
    isValid: {
      get() {
        if (this.field.disableValidator === true) return "";
        return this.isFieldValid(this.field, this.getValue);
      },
      set(newValue: boolean) {
        this.isValid = newValue;
      },
    },
    getValue() {
      return objGet(this.model, this.field.model);
    },
    showField() {
      if (
        this.options?.summary === true &&
        this.field?.showInSummary === false
      ) {
        return false;
      }
      return true;
    },
  },
  watch: {
    model: {
      handler(newVal) {
        if (this.fieldSchema?.dynamicProperties) {
          this.dynamicProps(this.fieldSchema, newVal);
        }
      },
      deep: true,
    },
    currentFieldValidationCalled: {
      handler(newVal) {
        if (newVal?.errors?.length) {
          this.isFieldTouched = 2;
          this.isValid = newVal.errors;
        }
      },
      deep: true,
    },
    getValue: {
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.isFieldTouched = 2;
        }
      },
      deep: true,
    },
  },
  methods: {
    dynamicProps(field: any, model: any) {
      let vm = this;
      if (
        field.dynamicProperties &&
        Object.keys(field.dynamicProperties).length
      ) {
        Object.entries(field.dynamicProperties).forEach(([key, value]) => {
          let valueType = vm.getType(value);
          if (valueType === "String") {
            field[key] = model[value as keyof typeof model];
          } else if (valueType === "Function") {
            field[key] = (value as any)(field, model);
          }
        });
      }
    },
    convertValidatorToFunction() {
      this.validatorConverted = true;
      if (this.field?.validator?.length) {
        if (Array.isArray(this.field.validator)) {
          let fieldValidator = this.field.validator.map((val: any) => {
            try {
              if (typeof val === "string") {
                return Function('"use strict";return (' + val + ")")();
              } else {
                return val;
              }
            } catch (ex) {
              return val;
            }
          });
          (this.field as any).validator = fieldValidator;
        }
      }
    },
    onBlur() {
      this.isFieldTouched = 2;
    },
    onClickOutside() {
      if (this.isFieldTouched === 1) this.isFieldTouched = 2;
    },
    onTouch() {
      if (this.isFieldTouched === 0) this.isFieldTouched = 1;
    },
    fieldFunctionHandler(field: TField, objectKey: string) {
      if (isFunction(field?.[objectKey]))
        return field?.[objectKey].call(this, this.model, field, this);

      if (isNil(field?.[objectKey])) return true;

      return field?.[objectKey];
    },
    // Should field type have a label?
    fieldTypeHasLabel(field: TField) {
      if (isNil(field.label)) return false;

      let relevantType = "";
      if (field.type === "input") {
        relevantType = field.inputType;
      } else {
        relevantType = field.type;
      }

      switch (relevantType) {
        case "button":
        case "submit":
        case "reset":
          return false;
        default:
          return true;
      }
    },
    getFieldID(schema: TField) {
      const idPrefix = objGet(this.options, "fieldIdPrefix", "");
      return slugifyFormID(schema, idPrefix);
    },
    // Get type of field 'field-xxx'. It'll be the name of HTML element
    getFieldType(fieldSchema: TField) {
      return "field-" + fieldSchema.type;
    },
    // Get type of button, default to 'button'
    getButtonType(btn: any) {
      return objGet(btn, "type", "button");
    },
    // Child field executed validation
    onFieldValidated(res: any, errors: any, field: TField) {
      this.$emit("validated", res, errors, field);
    },
    buttonVisibility(field: TField) {
      return field.buttons && field.buttons.length > 0;
    },
    buttonClickHandler(btn: any, field: TField, event: any) {
      return btn.onclick.call(this, this.model, field, event, this);
    },
    // Get current hint.
    fieldHint(field: TField) {
      if (isFunction(field.hint))
        return field.hint.call(this, this.model, field, this);

      return field.hint;
    },
    fieldErrors(field: TField) {
      return this.errors
        .filter((e: any) => e.field === field)
        .map((item: any) => item.error);
    },
    onModelUpdated(newVal: any, schema: any) {
      this.$emit("model-updated", newVal, schema);
    },
    validate(calledParent: any) {
      return this.$refs.child.validate(calledParent);
    },
    clearValidationErrors() {
      if (this.$refs.child) {
        return this.$refs.child.clearValidationErrors();
      }
    },
  },
};
</script>
<template>
  <div
    v-if="showField"
    class="field-container"
    :class="[
      options ? getFieldRowClasses(field, options.summary) : '',
      isFieldTouched > 1 && Array.isArray(isValid) && isValid.length > 0 ? 'field-validation-error' : '',
    ]"
  >
    <div @click.capture.once="onTouch" v-click-outside="onClickOutside" @blur.capture="onBlur" class="field-component">
      <label
        v-if="
          fieldSchema.independLabel ||
          (fieldSchema.readonly && fieldTypeHasLabel(fieldSchema) && !deniedLabels.includes(fieldSchema.type))
        "
        :for="getFieldID(fieldSchema)"
        :class="[fieldSchema.labelClasses, fieldSchema.labelInline ? 'inline-label' : 'block-label']"
        class="v-label"
      >
        <span v-html="fieldFunctionHandler(fieldSchema, 'label')"></span>
        <span v-if="fieldSchema.help" class="help">
          <i class="icon"></i>
          <div class="helpText" v-html="fieldSchema.help"></div>
        </span>
      </label>
      <span v-if="fieldSchema && fieldSchema.containerIcon">
        <v-icon
          :id="fieldSchema.containerIcon.fieldId"
          :class="fieldSchema.containerIcon.classes"
          :style="fieldSchema.containerIcon.styles"
          :color="fieldSchema.containerIcon.color"
          :dark="fieldSchema.containerIcon.dark"
          :dense="fieldSchema.containerIcon.dense"
          :disabled="fieldSchema.containerIcon.disabled"
          :large="fieldSchema.containerIcon.large"
          :left="fieldSchema.containerIcon.left"
          :light="fieldSchema.containerIcon.light"
          :right="fieldSchema.containerIcon.right"
          :size="fieldSchema.containerIcon.size"
          :small="fieldSchema.containerIcon.small"
          :tag="fieldSchema.containerIcon.tag"
          :x-large="fieldSchema.containerIcon.xLarge"
          :x-small="fieldSchema.containerIcon.xSmall"
          v-bind="{ ...fieldSchema.containerIcon.attributes }"
        >
          {{ fieldSchema.containerIcon.icon }}
        </v-icon>
      </span>
      <span :class="fieldSchema.labelInline ? 'inline-label' : 'block-label'">
        <component
          ref="child"
          :is="getFieldType(fieldSchema)"
          :dfb="dfb"
          :disabled="fieldDisabled(fieldSchema)"
          :model="model"
          :schema="fieldSchema"
          :formOptions="options"
          :validationStatus="validationStatus"
          :submit="submit"
          :isSubForm="true"
          @validated="onFieldValidated"
        ></component>
        <template v-if="isFieldTouched > 1">
          <div
            v-if="(typeof isValid == 'boolean' && isValid !== true) || (Array.isArray(isValid) && isValid.length > 0)"
            class="messages"
            role="alert"
          >
            <div
              v-for="(item, index) in isValid"
              :key="`${fieldSchema.fieldId}-message-${String(index)}`"
              class="message"
              v-html="item"
            ></div>
          </div>
        </template>
      </span>
    </div>
  </div>
</template>
