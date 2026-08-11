import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";

// Compound weight input: lets someone type in grams or kg, but always stores
// the canonical value in kg (full precision, no rounding — weight feeds
// pricing/metal calculations elsewhere). Switching the unit just changes how
// the same underlying kg value is displayed, it never re-scales the data.
function WeightInput({
  valueKg,
  onChangeKg,
  error,
  fieldName,
}: {
  valueKg: string;
  onChangeKg: (kg: string) => void;
  error?: boolean;
  fieldName: string;
}) {
  const [unit, setUnit] = useState<"g" | "kg">(() => {
    const kg = parseFloat(valueKg);
    return !isNaN(kg) && kg >= 1 ? "kg" : "g";
  });

  const kgNum = parseFloat(valueKg);
  const displayAmount = isNaN(kgNum) ? "" : String(unit === "g" ? kgNum * 1000 : kgNum);

  const handleAmountChange = (raw: string) => {
    if (raw === "") {
      onChangeKg("");
      return;
    }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    onChangeKg(String(unit === "g" ? num / 1000 : num));
  };

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        step="any"
        value={displayAmount}
        onChange={(e) => handleAmountChange(e.target.value)}
        className={error ? "border-destructive" : ""}
        data-testid={`input-${fieldName}`}
      />
      <Select value={unit} onValueChange={(v) => setUnit(v as "g" | "kg")}>
        <SelectTrigger className="w-20" data-testid={`select-${fieldName}-unit`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="g">g</SelectItem>
          <SelectItem value="kg">kg</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select" | "date" | "weight";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
  title: string;
  fields: FormField[];
  initialData?: Record<string, any>;
  submitLabel?: string;
  isLoading?: boolean;
}

export default function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  initialData = {},
  submitLabel = "Save",
  isLoading = false,
}: FormModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const formRef = useRef<HTMLFormElement>(null);

  // Update form data when initialData changes (for editing)
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (
        field.required &&
        (!formData[field.name] || formData[field.name] === "")
      ) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("Form submitted with data:", formData);
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setFormData(initialData);
    setErrors({});
    onClose();
  };

  const renderField = (field: FormField) => {
    // For number fields, allow empty string or 0, otherwise use empty string as default
    const value = formData[field.name] !== undefined && formData[field.name] !== null ? formData[field.name] : "";
    const error = errors[field.name];

    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={error ? "border-destructive" : ""}
            data-testid={`input-${field.name}`}
          />
        );

      case "select":
        return (
          <Select
            value={value}
            onValueChange={(value) => handleInputChange(field.name, value)}
          >
            <SelectTrigger
              className={error ? "border-destructive" : ""}
              data-testid={`select-${field.name}`}
            >
              <SelectValue
                placeholder={field.placeholder || `Select ${field.label}`}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "weight":
        return (
          <WeightInput
            valueKg={value}
            onChangeKg={(kg) => handleInputChange(field.name, kg)}
            error={!!error}
            fieldName={field.name}
          />
        );

      default:
        return (
          <Input
            type={field.type}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={error ? "border-destructive" : ""}
            data-testid={`input-${field.name}`}
          />
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent data-testid="modal-form">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name} className="text-sm font-medium">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                {renderField(field)}
                {errors[field.name] && (
                  <p
                    className="text-sm text-destructive"
                    data-testid={`error-${field.name}`}
                  >
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}
          </form>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            onClick={() => formRef.current?.requestSubmit()}
            data-testid="button-submit"
          >
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
