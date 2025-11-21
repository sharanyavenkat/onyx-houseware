import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Customer, Item, Order } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable from "../components/DataTable";
import OrderFormModal from "../components/OrderFormModal";

const orderColumns = [
  { key: "po_number", label: "PO Number" },
  { key: "customer_name", label: "Customer" },
  {
    key: "order_date",
    label: "Order Date",
    render: (value: string) => formatDate(value),
  },
  {
    key: "fulfillment_date",
    label: "Fulfillment Date",
    render: (value: string) => (value ? formatDate(value) : "-"),
  },
  {
    key: "items_count",
    label: "Items",
    render: (_: any, row: any) => row.line_items?.length || 0,
  },
  {
    key: "total_pieces",
    label: "Total Pcs",
    render: (_: any, row: any) =>
      row.line_items?.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      ) || 0,
  },
  {
    key: "status",
    label: "Status",
    render: (value: string) => {
      const variants: Record<string, any> = {
        draft: "secondary",
        confirmed: "default",
        fulfilled: "default",
        cancelled: "destructive",
      };
      return <Badge variant={variants[value] || "secondary"}>{value}</Badge>;
    },
  },
];

export default function Orders() {
  const [location, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const { toast } = useToast();

  // Read URL query parameter for filter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get("filter");
    if (filterParam === "pending") {
      setStatusFilter("pending");
    }
  }, [location]);

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Map customer data for dropdown
  const customerOptions = useMemo(() => {
    return customers.map((c) => ({
      value: c.id.toString(),
      label: c.company_name,
    }));
  }, [customers]);

  // Map orders to include customer names
  const ordersWithCustomerNames = useMemo(() => {
    return orders.map((order) => ({
      ...order,
      customer_name:
        customers.find((c) => c.id === order.customer_id)?.company_name ||
        "Unknown",
    }));
  }, [orders, customers]);

  // Get unique months from orders
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach((order) => {
      if (order.order_date) {
        const date = new Date(order.order_date);
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  // Filter orders by selected month and status
  const filteredOrders = useMemo(() => {
    let result = ordersWithCustomerNames;

    // Filter by month
    if (selectedMonth !== "all") {
      result = result.filter((order) => {
        if (!order.order_date) return false;
        const date = new Date(order.order_date);
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        return monthKey === selectedMonth;
      });
    }

    // Filter by status
    if (statusFilter === "pending") {
      result = result.filter(
        (order) => order.status === "draft" || order.status === "confirmed"
      );
    } else if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    return result;
  }, [ordersWithCustomerNames, selectedMonth, statusFilter]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/pending-by-item"] });
      toast({ title: "Order created successfully" });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/pending-by-item"] });
      toast({ title: "Order updated successfully" });
      setIsModalOpen(false);
      setEditingOrder(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/pending-by-item"] });
      toast({ title: "Order deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleView = (order: any) => {
    setLocation(`/orders/${order.id}`);
  };

  const handleDelete = (order: any) => {
    setOrderToDelete(order);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deleteMutation.mutate(orderToDelete.id);
      setIsConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleSubmit = (data: any) => {
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const enhancedColumns = [
    ...orderColumns,
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: any) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleView(row)}
          data-testid={`button-view-${row.id}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  };

  return (
    <div className="space-y-6" data-testid="page-orders">
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm font-medium">Filter by Month:</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger
            className="w-[200px]"
            data-testid="select-month-filter"
          >
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {formatMonthLabel(month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-sm font-medium">Filter by Status:</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[200px]"
            data-testid="select-status-filter"
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending (Draft + Confirmed)</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={enhancedColumns}
        data={filteredOrders}
        title="Orders"
        addButtonLabel="Add Order"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        onSubmit={handleSubmit}
        title={editingOrder ? "Edit Order" : "Add New Order"}
        initialData={editingOrder || {}}
        submitLabel={editingOrder ? "Update Order" : "Add Order"}
        customers={customerOptions}
        items={items}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        onConfirm={confirmDelete}
        title="Delete Order"
        description={`Are you sure you want to delete order "${orderToDelete?.po_number}"? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}
