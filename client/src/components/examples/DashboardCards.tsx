import DashboardCards from '../DashboardCards';

const exampleData = {
  totalOrders: 125,
  pendingOrders: 12,
  totalItems: 48,
  totalCustomers: 35,
};

export default function DashboardCardsExample() {
  return (
    <div className="p-6">
      <DashboardCards data={exampleData} />
    </div>
  );
}