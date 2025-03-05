import React from 'react';
import { Field } from 'formik';
import { TextField, MenuItem, Fade } from '@mui/material';
import { FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import {
  getMappedFieldNamesForClass,
  getAttributesForObjectName,
} from '../path/to/useOcsfData'; // adjust the path accordingly

// Interface for each attribute item.
interface AttributeItem {
  fieldName: string;
  fieldDescription: string;
  fieldType: string;   // e.g., "object_t", "string_t", etc.
  objectType: string;  // if fieldType is "object_t"
}

// Each level in our drill-down stack.
interface LevelInfo {
  title: string;
  items: AttributeItem[];
}

interface MappedFieldDropdownProps {
  /** Formik field path for the mapped field name (e.g., events[0].importedFields[0].mappedField.name) */
  fieldNamePath: string;
  /** Formik field path for the mapped field description */
  descPath: string;
  /** The currently selected OCSF class (e.g., "memory_activity") */
  selectedClassName: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
}

export function MappedFieldDropdown({
  fieldNamePath,
  descPath,
  selectedClassName,
  disabled = false,
}: MappedFieldDropdownProps): JSX.Element {
  // State: stack of levels for drill-down.
  const [stack, setStack] = React.useState<LevelInfo[]>([]);
  // State: pathSegments stores the current hierarchy (e.g., ["actor", "process"]).
  const [pathSegments, setPathSegments] = React.useState<string[]>([]);
  // State: open controls the dropdown's open/closed state.
  const [open, setOpen] = React.useState<boolean>(false);

  // When selectedClassName changes, load top-level attributes.
  React.useEffect(() => {
    if (!selectedClassName) {
      setStack([]);
      setPathSegments([]);
      return;
    }
    const topAttrs = getMappedFieldNamesForClass(selectedClassName);
    const sortedAttrs = topAttrs.sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName)
    );
    setStack([{ title: selectedClassName, items: sortedAttrs }]);
    // At top level, start with an empty hierarchy.
    setPathSegments([]);
  }, [selectedClassName]);

  // Current level is the last element in the stack.
  const currentLevel = stack[stack.length - 1] || null;

  // Build the menu items for the dropdown.
  function buildMenuItems(): JSX.Element[] {
    const items: JSX.Element[] = [
      <MenuItem key="__NONE__" value="" sx={{ padding: '0.5rem 1rem' }}>
        -- None --
      </MenuItem>,
    ];

    // If we're not at the root, add a Back option.
    if (stack.length > 1) {
      items.push(
        <MenuItem
          key="__BACK__"
          value="__BACK__"
          sx={{
            padding: '0.5rem 1rem',
            fontWeight: 'bold',
            backgroundColor: '#f0f0f0',
            '&:hover': { backgroundColor: '#e0e0e0' },
          }}
        >
          <FaArrowLeft style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
          Back to {stack[stack.length - 2].title}
        </MenuItem>
      );
    }

    if (currentLevel) {
      const sortedItems = [...currentLevel.items].sort((a, b) =>
        a.fieldName.localeCompare(b.fieldName)
      );
      sortedItems.forEach((attr) => {
        const label =
          attr.fieldType === 'object_t'
            ? `${attr.fieldName} `
            : attr.fieldName;
        items.push(
          <MenuItem key={attr.fieldName} value={attr.fieldName} sx={{ padding: '0.5rem 1rem' }}>
            {attr.fieldType === 'object_t' ? (
              <>
                {label}
                <FaArrowRight style={{ verticalAlign: 'middle', marginLeft: '0.25rem' }} />
              </>
            ) : (
              label
            )}
          </MenuItem>
        );
      });
    } else {
      items.push(
        <MenuItem key="__EMPTY__" value="__EMPTY__" sx={{ padding: '0.5rem 1rem' }}>
          (No attributes)
        </MenuItem>
      );
    }
    return items;
  }

  // The full hierarchical path as a dot-separated string for the separate text field.
  function getFullHierarchy(): string {
    return pathSegments.join('.');
  }

  // The dropdown's displayed value: show only the current (last) segment.
  function getDropdownValue(): string {
    return pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';
  }

  // Handle dropdown selection changes.
  function handleSelect(e: React.ChangeEvent<HTMLInputElement>, form: any) {
    const chosenValue = e.target.value;

    // Handle the Back option.
    if (chosenValue === '__BACK__') {
      if (stack.length > 1) {
        // If we're at the first drill-down level, going back resets to root.
        if (stack.length === 2) {
          setStack([stack[0]]);
          setPathSegments([]);
          form.setFieldValue(fieldNamePath, '');
          form.setFieldValue(descPath, '');
        } else {
          const newStack = stack.slice(0, stack.length - 1);
          const newPath = pathSegments.slice(0, pathSegments.length - 1);
          setStack(newStack);
          setPathSegments(newPath);
          form.setFieldValue(fieldNamePath, newPath[newPath.length - 1] || '');
          form.setFieldValue(descPath, '');
        }
      }
      return;
    }

    // Handle "None" selection: reset the selection.
    if (chosenValue === '') {
      setStack(stack.length > 0 ? [stack[0]] : []);
      setPathSegments([]);
      form.setFieldValue(fieldNamePath, '');
      form.setFieldValue(descPath, '');
      return;
    }

    if (!currentLevel) return;
    const chosenAttr = currentLevel.items.find((a) => a.fieldName === chosenValue);
    if (!chosenAttr) {
      form.setFieldValue(fieldNamePath, '');
      return;
    }

    // If the attribute is drillable.
    if (chosenAttr.fieldType === 'object_t' && chosenAttr.objectType) {
      // If at top level a leaf was previously selected, reset before drilling.
      if (stack.length === 1 && pathSegments.length > 0) {
        const topAttrs = getMappedFieldNamesForClass(selectedClassName);
        const sortedTopAttrs = topAttrs.sort((a, b) =>
          a.fieldName.localeCompare(b.fieldName)
        );
        setStack([{ title: selectedClassName, items: sortedTopAttrs }]);
        setPathSegments([]);
      }
      const childAttrs = getAttributesForObjectName(chosenAttr.objectType);
      const sortedChildAttrs = childAttrs.sort((a, b) =>
        a.fieldName.localeCompare(b.fieldName)
      );
      // Push new level.
      setStack((prev) => [...prev, { title: chosenAttr.fieldName, items: sortedChildAttrs }]);
      // Append new branch to the hierarchy.
      setPathSegments((prev) => [...prev, chosenAttr.fieldName]);
      // Update form fields; for drill-down, we don't finalize leaf selection.
      form.setFieldValue(fieldNamePath, '');
      form.setFieldValue(descPath, '');
      return;
    }

    // For a leaf attribute:
    // At top level, the new leaf should replace the existing leaf.
    if (stack.length === 1) {
      setPathSegments([chosenAttr.fieldName]);
    } else {
      // In drill-down mode, replace only the last segment.
      const newPath = [...pathSegments.slice(0, stack.length - 1), chosenAttr.fieldName];
      setPathSegments(newPath);
    }
    form.setFieldValue(fieldNamePath, chosenAttr.fieldName);
    form.setFieldValue(descPath, chosenAttr.fieldDescription);
    // Optionally, close the dropdown when a leaf is selected.
    setOpen(false);
  }

  return (
    <>
      {/* Read-only text field showing the full hierarchy */}
      <TextField
        label="Hierarchy"
        value={getFullHierarchy()}
        fullWidth
        InputProps={{ readOnly: true }}
        sx={{ mb: '0.5rem' }}
      />
      <Field name={fieldNamePath}>
        {({ field, meta, form }: any) => (
          <TextField
            {...field}
            select
            fullWidth
            label="OCSF Field Name"
            disabled={disabled || !selectedClassName}
            error={meta.touched && Boolean(meta.error)}
            helperText={meta.touched && meta.error}
            value={getDropdownValue()}
            onChange={(e) => handleSelect(e, form)}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            SelectProps={{
              disableCloseOnSelect: true,
              open: open,
              MenuProps: {
                PaperProps: {
                  style: { maxHeight: '12.5rem' }, // 12.5rem ≈ 200px
                },
                TransitionComponent: Fade,
              },
            }}
          >
            {buildMenuItems()}
          </TextField>
        )}
      </Field>
    </>
  );
}

export default MappedFieldDropdown;
