import MonthPicker from '../MonthPicker';
import { useState } from 'react';

export default function MonthPickerExample() {
  const [selectedMonth, setSelectedMonth] = useState('2025-01');
  
  return (
    <div className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Month Picker</h3>
        <MonthPicker 
          value={selectedMonth} 
          onChange={setSelectedMonth} 
        />
        <div className="text-sm text-muted-foreground">
          Selected: {selectedMonth}
        </div>
      </div>
    </div>
  );
}