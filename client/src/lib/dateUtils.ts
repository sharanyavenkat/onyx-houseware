export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function toInputDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export function fromInputDate(inputDate: string): string {
  if (!inputDate) return '';
  return inputDate; // Keep as YYYY-MM-DD for storage
}
