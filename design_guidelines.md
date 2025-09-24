# Onyx Houseware Order Management App - Design Guidelines

## Design Approach: Utility-Focused Design System
**Selected System:** Material Design adapted for enterprise applications
**Justification:** This is a productivity-focused, data-heavy application where efficiency and learnability are paramount. The admin will use this tool daily for order management, requiring clear information hierarchy and consistent patterns.

## Core Design Elements

### A. Color Palette
**Primary Colors (Dark Mode):**
- Background: 220 13% 9% (dark slate)
- Surface: 220 13% 14% (elevated surfaces)
- Primary: 220 100% 60% (blue for actions)
- Text Primary: 220 13% 91% (high contrast text)

**Primary Colors (Light Mode):**
- Background: 0 0% 98% (off-white)
- Surface: 0 0% 100% (pure white)
- Primary: 220 100% 50% (blue for actions)
- Text Primary: 220 13% 15% (dark text)

**Status Colors:**
- Success: 142 71% 45% (green for fulfilled orders)
- Warning: 38 92% 50% (amber for draft/pending)
- Error: 0 84% 60% (red for cancelled)
- Info: 199 89% 48% (cyan for notifications)

### B. Typography
**Font Stack:** Inter via Google Fonts CDN
- Headers: font-semibold (600 weight)
- Body text: font-normal (400 weight)
- UI elements: font-medium (500 weight)
- Data tables: font-mono for numbers

**Scale:**
- Page titles: text-2xl
- Section headers: text-lg
- Body text: text-sm
- Captions/metadata: text-xs

### C. Layout System
**Spacing Units:** Consistent use of Tailwind units 2, 4, 6, 8, 12
- Component padding: p-4, p-6
- Section margins: mb-8, mt-6
- Element spacing: space-y-4, gap-4
- Form fields: space-y-2

**Grid System:**
- Main layout: 12-column grid with sidebar
- Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Tables: full-width responsive with horizontal scroll

### D. Component Library

**Navigation:**
- Fixed sidebar (w-64) with collapsible mobile drawer
- Clean icons from Heroicons outline set
- Active state with subtle background and primary text color

**Data Tables:**
- Alternating row backgrounds for readability
- Sticky headers on scroll
- Action buttons right-aligned
- Status badges with appropriate colors

**Forms:**
- Clean input fields with focus rings
- Label positioning above inputs
- Error states with red borders and helper text
- Submit buttons with loading states

**Cards:**
- Subtle shadows (shadow-sm)
- Rounded corners (rounded-lg)
- Consistent padding (p-6)
- Clear hierarchy with headers

**Modals/Overlays:**
- Backdrop blur effect
- Centered positioning with max-width constraints
- Clean close buttons (×) in top-right
- Form modals for CRUD operations

### E. Key Interface Patterns

**Dashboard:**
- Metric cards in grid layout showing order counts
- Monthly filter prominently placed
- Top items table with clear hierarchy
- Quick action buttons for common tasks

**CRUD Pages:**
- Search/filter bar at top
- Add new button prominently placed (top-right)
- Table with inline actions (edit, delete)
- Pagination for large datasets

**Order Management:**
- Master-detail view for orders and line items
- Status workflow clearly indicated
- Customer information prominently displayed
- Line items in clean table format

**Indent Calculations:**
- Month picker as primary filter
- Calculated fields clearly differentiated from inputs
- Inline editing capabilities
- Auto-save indicators

### F. Responsive Behavior
- Mobile-first approach with collapsible sidebar
- Tables convert to cards on mobile
- Form layouts stack vertically on small screens
- Touch-friendly button sizes (min-h-10)

### G. Performance Considerations
- Minimal animations (subtle transitions only)
- Efficient re-renders for data updates
- Lazy loading for large tables
- Optimistic updates for form submissions

This design system prioritizes clarity, efficiency, and consistency—essential for a business-critical order management application where accuracy and speed are paramount.