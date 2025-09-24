import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useState } from "react";

interface MonthPickerProps {
  value?: string; // Format: YYYY-MM
  onChange: (value: string) => void;
  className?: string;
}

export default function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const currentDate = new Date();
  const currentMonth = value || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  
  const [year, month] = currentMonth.split('-').map(Number);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePreviousMonth = () => {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const newValue = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    console.log('Previous month selected:', newValue);
    onChange(newValue);
  };

  const handleNextMonth = () => {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const newValue = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    console.log('Next month selected:', newValue);
    onChange(newValue);
  };

  const handleMonthChange = (newMonth: string) => {
    const newValue = `${year}-${String(Number(newMonth)).padStart(2, '0')}`;
    console.log('Month changed to:', newValue);
    onChange(newValue);
  };

  const handleYearChange = (newYear: string) => {
    const newValue = `${newYear}-${String(month).padStart(2, '0')}`;
    console.log('Year changed to:', newValue);
    onChange(newValue);
  };

  // Generate year options (current year ± 5 years)
  const yearOptions = [];
  for (let i = currentDate.getFullYear() - 5; i <= currentDate.getFullYear() + 5; i++) {
    yearOptions.push(i);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousMonth}
        data-testid="button-previous-month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        
        <Select value={String(month)} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[130px]" data-testid="select-month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, index) => (
              <SelectItem key={index + 1} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[80px]" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((yearOption) => (
              <SelectItem key={yearOption} value={String(yearOption)}>
                {yearOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNextMonth}
        data-testid="button-next-month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="text-sm text-muted-foreground ml-2" data-testid="text-selected-month">
        {monthNames[month - 1]} {year}
      </div>
    </div>
  );
}