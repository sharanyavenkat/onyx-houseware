import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Search, Plus, Eye } from "lucide-react";
import { useState } from "react";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  hideOnMobile?: boolean;
  isPrimary?: boolean;
  isAction?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onView?: (item: any) => void;
  searchable?: boolean;
  addButtonLabel?: string;
  title?: string;
  canMutate?: boolean;
}

export default function DataTable({ 
  columns, 
  data, 
  onAdd, 
  onEdit, 
  onDelete, 
  onView,
  searchable = true,
  addButtonLabel = "Add New",
  title = "Data",
  canMutate = true
}: DataTableProps) {
  const showMutationActions = canMutate && (onEdit || onDelete);
  const showActions = showMutationActions || onView;
  const showAddButton = canMutate && onAdd;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = searchable 
    ? data.filter(item => 
        Object.values(item).some(value => 
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : data;

  const handleAdd = () => {
    onAdd?.();
  };

  const handleEdit = (item: any) => {
    onEdit?.(item);
  };

  const handleDelete = (item: any) => {
    onDelete?.(item);
  };

  const handleView = (item: any) => {
    onView?.(item);
  };

  const dataColumns = columns.filter(c => !c.isAction);
  const primaryColumn = dataColumns.find(c => c.isPrimary) || dataColumns[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold" data-testid={`text-${title.toLowerCase()}-title`}>
          {title}
        </h2>
        {showAddButton && (
          <Button onClick={handleAdd} data-testid="button-add-new" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {addButtonLabel}
          </Button>
        )}
      </div>

      {/* Search */}
      {searchable && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      )}

      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden md:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              {showActions && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (showActions ? 1 : 0)} 
                  className="text-center py-8 text-muted-foreground"
                  data-testid="text-no-data"
                >
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item, index) => (
                <TableRow key={index} data-testid={`row-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.key} data-testid={`cell-${column.key}-${index}`}>
                      {column.render ? column.render(item[column.key], item) : item[column.key]}
                    </TableCell>
                  ))}
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(item)}
                            data-testid={`button-view-${index}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {showMutationActions && onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${index}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {showMutationActions && onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Layout - Hidden on desktop */}
      <div className="md:hidden space-y-3">
        {filteredData.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-data-mobile">
              No data found
            </CardContent>
          </Card>
        ) : (
          filteredData.map((item, index) => (
            <Card key={index} data-testid={`card-${index}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Primary field as header */}
                    <div className="font-semibold text-base truncate">
                      {primaryColumn?.render 
                        ? primaryColumn.render(item[primaryColumn.key], item) 
                        : item[primaryColumn?.key]}
                    </div>
                    
                    {/* Other fields */}
                    <div className="space-y-1 text-sm">
                      {dataColumns.filter(c => c !== primaryColumn && !c.hideOnMobile).map((column) => (
                        <div key={column.key} className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">{column.label}:</span>
                          <span className="truncate">
                            {column.render ? column.render(item[column.key], item) : item[column.key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {showActions && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {onView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(item)}
                          data-testid={`button-view-mobile-${index}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {showMutationActions && onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-mobile-${index}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {showMutationActions && onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-mobile-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-sm text-muted-foreground" data-testid="text-total-count">
        Showing {filteredData.length} of {data.length} entries
      </div>
    </div>
  );
}
