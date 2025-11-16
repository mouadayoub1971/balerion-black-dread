# UI Design Preferences & Style Guide

## Overview

This document serves as a comprehensive reference for the UI/UX design patterns, styling conventions, and component usage preferences for this project. Use this guide when building new features or components to maintain consistency across the application.

---

## Tech Stack & Foundation

### Framework & Libraries
- **Framework**: React
- **UI Library**: shadcn/ui (New York style variant)
- **Styling**: Tailwind CSS 4.1.9 with CSS variables
- **Color Space**: OKLCH (modern perceptually uniform color space)
- **Theme Management**: next-themes for dark/light mode
- **Icon Libraries**:
  - Tabler Icons (primary - for app-specific icons)
  - Lucide React (secondary - for system icons like X, ChevronDown)

### Key Dependencies
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack React Table with dnd-kit drag-and-drop
- **Dialogs/Overlays**: Radix UI primitives (Dialog, Sheet, Popover)
- **Drawers**: Vaul (better mobile experience)
- **Toasts**: Sonner
- **Typography**: Geist Sans & Geist Mono (from Vercel)

---

## Color Scheme & Theme Configuration

**Location**: `app/globals.css`

### Color Philosophy
- Use **OKLCH color space** for all color definitions (modern, perceptually uniform)
- CSS variables for all colors (enables easy theming)
- Semantic color naming (primary, secondary, muted, etc.)
- Neutral base color palette (defined in `components.json`)

### Light Mode Colors (`:root`)

```css
--background: oklch(1 0 0);                    /* Pure white */
--foreground: oklch(0.145 0 0);                /* Almost black */
--primary: oklch(0.205 0 0);                   /* Dark (key actions) */
--primary-foreground: oklch(0.985 0 0);        /* White text on primary */
--secondary: oklch(0.97 0 0);                  /* Very light gray */
--secondary-foreground: oklch(0.205 0 0);      /* Dark text */
--muted: oklch(0.97 0 0);                      /* Light gray backgrounds */
--muted-foreground: oklch(0.556 0 0);          /* Medium gray text */
--accent: oklch(0.97 0 0);                     /* Light gray highlights */
--accent-foreground: oklch(0.205 0 0);         /* Dark text on accent */
--destructive: oklch(0.577 0.245 27.325);      /* Red for errors/warnings */
--border: oklch(0.922 0 0);                    /* Very light gray borders */
--input: oklch(0.922 0 0);                     /* Input backgrounds */
--ring: oklch(0.708 0 0);                      /* Focus ring (medium gray) */
```

### Dark Mode Colors (`.dark`)

```css
--background: oklch(0.145 0 0);                /* Almost black */
--foreground: oklch(0.985 0 0);                /* White */
--primary: oklch(0.985 0 0);                   /* White (inverted) */
--primary-foreground: oklch(0.205 0 0);        /* Dark */
--secondary: oklch(0.269 0 0);                 /* Dark gray */
--muted: oklch(0.269 0 0);                     /* Dark gray */
--muted-foreground: oklch(0.708 0 0);          /* Light gray text */
--destructive: oklch(0.396 0.141 25.723);      /* Darker red */
--border: oklch(0.269 0 0);                    /* Dark gray borders */
```

### Chart Colors

**Light Mode**:
```css
--chart-1: oklch(0.646 0.222 41.116);   /* Orange/warm tone */
--chart-2: oklch(0.6 0.118 184.704);    /* Blue/cool tone */
--chart-3: oklch(0.398 0.07 227.392);   /* Navy blue */
--chart-4: oklch(0.828 0.189 84.429);   /* Yellow/lime */
--chart-5: oklch(0.769 0.188 70.08);    /* Yellow */
```

**Dark Mode**:
```css
--chart-1: oklch(0.488 0.243 264.376);  /* Purple */
--chart-2: oklch(0.696 0.17 162.48);    /* Teal/cyan */
--chart-3: oklch(0.769 0.188 70.08);    /* Yellow */
--chart-4: oklch(0.627 0.265 303.9);    /* Magenta */
--chart-5: oklch(0.645 0.246 16.439);   /* Orange/red */
```

### Sidebar-Specific Colors

```css
/* Light Mode */
--sidebar: oklch(0.985 0 0);                   /* Light background */
--sidebar-foreground: oklch(0.145 0 0);        /* Dark text */
--sidebar-primary: oklch(0.205 0 0);           /* Dark accent */
--sidebar-accent: oklch(0.97 0 0);             /* Hover state */
--sidebar-border: oklch(0.922 0 0);            /* Border color */

/* Dark Mode */
--sidebar: oklch(0.205 0 0);                   /* Dark background */
--sidebar-foreground: oklch(0.985 0 0);        /* Light text */
--sidebar-primary: oklch(0.488 0.243 264.376); /* Purple accent */
--sidebar-accent: oklch(0.269 0 0);            /* Hover state */
```

### Usage Pattern

Always reference colors via CSS variables, never hardcode:

```tsx
// ✅ Good
className="bg-primary text-primary-foreground"
style={{ color: "var(--primary)" }}

// ❌ Bad
className="bg-black text-white"
style={{ color: "#000000" }}
```

---

## Typography

### Font Families

```css
--font-sans: var(--font-geist-sans);  /* Body text */
--font-mono: var(--font-geist-mono);  /* Code/monospace */
```

**Implementation**: Fonts are loaded in `app/layout.tsx` via Vercel's Geist font package.

### Text Hierarchy

- **Headings**: Use `font-semibold` with appropriate text sizes
- **Body**: Default font weight (400)
- **Muted Text**: Use `text-muted-foreground` class
- **Small Text**: `text-sm` (0.875rem)
- **Labels**: `text-sm` with `font-medium`

### Examples

```tsx
<div className="text-lg font-semibold">Dialog Title</div>
<div className="text-sm text-muted-foreground">Card Description</div>
<label className="text-sm font-medium">Input Label</label>
```

---

## Spacing & Layout

### Border Radius

```css
--radius: 0.625rem;                      /* Base: 10px */
--radius-sm: calc(var(--radius) - 4px);  /* 6px */
--radius-md: calc(var(--radius) - 2px);  /* 8px */
--radius-lg: var(--radius);              /* 10px */
--radius-xl: calc(var(--radius) + 4px);  /* 14px */
```

**Usage**:
- Cards: `rounded-xl` (14px)
- Buttons: `rounded-md` (8px)
- Inputs: `rounded-md` (8px)
- Dialogs: `rounded-lg` (10px)
- Small elements: `rounded-xs` (6px)

### Sidebar Dimensions

```css
--sidebar-width: calc(var(--spacing) * 72);      /* 18rem (288px) */
--sidebar-width-mobile: 18rem;                   /* 288px */
--sidebar-width-icon: 3rem;                      /* 48px (collapsed) */
--header-height: calc(var(--spacing) * 12);      /* 3rem (48px) */
```

### Container Padding

- **Cards**: `py-6 px-6` (24px vertical, 24px horizontal)
- **Card Content**: `px-6` (maintains horizontal alignment)
- **Dialogs**: `p-6` (24px all sides)
- **Responsive**: Reduce to `px-2` on mobile, `px-6` on `sm:` and up

---

## shadcn/ui Configuration

**Location**: `components.json`

```json
{
  "style": "new-york",           // Modern, clean design style
  "rsc": true,                   // React Server Components enabled
  "tsx": true,                   // TypeScript
  "tailwind": {
    "baseColor": "neutral",      // Neutral color palette
    "cssVariables": true,        // Use CSS variables for theming
    "prefix": ""                 // No class prefix
  },
  "iconLibrary": "lucide"        // Default icon library for shadcn components
}
```

### Path Aliases

```json
{
  "@/components": "components",
  "@/ui": "components/ui",
  "@/lib": "lib",
  "@/hooks": "hooks"
}
```

### Available Components (50+ shadcn/ui components)

**Core Components**: Button, Input, Label, Card, Badge, Avatar, Separator

**Form Components**: Checkbox, Radio Group, Select, Switch, Textarea, Form, Input OTP

**Data Display**: Table, Accordion, Tabs, Breadcrumb, Pagination, Progress, Skeleton

**Overlays**: Dialog, Alert Dialog, Drawer, Sheet, Popover, Tooltip, Hover Card, Toast

**Navigation**: Sidebar (with full subcomponents), Navigation Menu, Menubar, Context Menu, Dropdown Menu

**Charts**: Chart (Recharts wrapper with theming)

**Advanced**: Command, Slider, Toggle, Toggle Group, Calendar, Carousel, Aspect Ratio, Collapsible, Resizable, Scroll Area

---

## Sidebar Implementation

**Location**: `components/app-sidebar.tsx`

### Structure & Hierarchy

```tsx
<Sidebar collapsible="offcanvas">
  <SidebarHeader>
    {/* Logo/brand */}
  </SidebarHeader>

  <SidebarContent>
    <NavMain />       {/* Primary navigation */}
    <NavDocuments />  {/* Document shortcuts */}
    <NavSecondary />  {/* Settings/Help (mt-auto for bottom) */}
  </SidebarContent>

  <SidebarFooter>
    <NavUser />       {/* User profile dropdown */}
  </SidebarFooter>
</Sidebar>
```

### Key Patterns

1. **Collapsible Behavior**: Use `collapsible="offcanvas"` for mobile drawer-style collapse
2. **Icons**: Tabler Icons for all menu items (consistent icon family)
3. **Menu Structure**: Use `SidebarMenu` → `SidebarMenuItem` → `SidebarMenuButton`
4. **Tooltips**: Add `tooltip` prop to `SidebarMenuButton` for collapsed state
5. **State Management**: Provided by `SidebarProvider` context
6. **Keyboard Shortcut**: Press 'B' to toggle sidebar

### Sidebar Components

**NavMain** (`nav-main.tsx`):
- Primary menu items (Dashboard, Lifecycle, Analytics, Projects, Team)
- Quick Create button with `bg-primary` styling
- Inbox button with `outline` variant
- Icon + text layout

**NavUser** (`nav-user.tsx`):
- Avatar with grayscale effect
- User name & email display
- Dropdown menu (Account, Billing, Notifications, Log out)
- Context-aware positioning (bottom on mobile, right on desktop)

**NavDocuments** (`nav-documents.tsx`):
- Document/resource shortcuts
- Same icon + text pattern

**NavSecondary** (`nav-secondary.tsx`):
- Use `className="mt-auto"` to push to bottom
- Settings, Help, Search links

### Styling Details

```tsx
// Example: Primary action button in sidebar
<SidebarMenuButton
  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground duration-200 ease-linear"
>
  <IconCirclePlusFilled />
  <span>Quick Create</span>
</SidebarMenuButton>

// Example: Collapsible-aware elements
<Button
  className="size-8 group-data-[collapsible=icon]:opacity-0"
  variant="outline"
>
  <IconMail />
</Button>
```

### Data-Driven Pattern

Define navigation data as objects, then map:

```tsx
const data = {
  navMain: [
    { title: "Dashboard", url: "#", icon: IconDashboard },
    { title: "Analytics", url: "#", icon: IconChartBar },
    // ...
  ]
}
```

---

## Popups, Modals & Dialogs

### Dialog Component (`components/ui/dialog.tsx`)

**Based on**: Radix UI Dialog primitive

**Use Cases**: Important actions, forms, confirmations requiring user focus

**Key Features**:
- Semi-transparent overlay: `bg-black/50`
- Centered positioning: `top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]`
- Max width: `max-w-[calc(100%-2rem)]` mobile, `sm:max-w-lg` desktop
- Rounded corners: `rounded-lg`
- Shadow: `shadow-lg`
- Optional close button (X icon in top-right)
- Focus trap and accessibility built-in

**Animation**:
```tsx
className="data-[state=open]:animate-in data-[state=closed]:animate-out
           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
           data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
           duration-200"
```

**Structure**:
```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      {/* Actions */}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Layout**:
- Header: `flex flex-col gap-2 text-center sm:text-left`
- Footer: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`
- Title: `text-lg font-semibold`
- Description: `text-sm text-muted-foreground`

### Drawer Component (`components/ui/drawer.tsx`)

**Based on**: Vaul library (better mobile UX)

**Use Cases**: Mobile-first slide-out panels, settings, filters

**Directional Support**: top, bottom, left, right

**Key Features**:
- Drag handle on bottom drawer (visual affordance)
- Max height: `max-h-[80vh]` (prevents full screen takeover)
- Slide animations from appropriate edge
- Better touch gestures than Dialog on mobile

**When to Use**:
- Mobile: Always prefer Drawer over Dialog
- Desktop: Use Sheet or Dialog depending on content

### Sheet Component (`components/ui/sheet.tsx`)

**Based on**: Radix UI Dialog (alternative to Drawer)

**Use Cases**: Desktop slide-out panels

**Positions**: `top`, `right`, `bottom`, `left` (default: right)

**Max Width**: `max-w-sm` (28rem / 448px) on desktop

### Popover Component (`components/ui/popover.tsx`)

**Based on**: Radix UI Popover

**Use Cases**: Non-modal floating content, dropdowns, tooltips

**Key Features**:
- Width: `w-72` (288px)
- No overlay (non-modal)
- Auto-positioning with Radix Popper
- Shadow: `shadow-md`

**Example**:
```tsx
<Popover>
  <PopoverTrigger>Click me</PopoverTrigger>
  <PopoverContent>
    <p>Popover content here</p>
  </PopoverContent>
</Popover>
```

### Responsive Pattern: Dialog vs Drawer

```tsx
const isMobile = useIsMobile() // 768px breakpoint

// Conditionally render based on device
{isMobile ? (
  <Drawer>
    <DrawerContent>{/* ... */}</DrawerContent>
  </Drawer>
) : (
  <Dialog>
    <DialogContent>{/* ... */}</DialogContent>
  </Dialog>
)}
```

---

## Charts & Data Visualization

### Chart Component (`components/ui/chart.tsx`)

**Based on**: Recharts library with custom theming wrapper

**Key Features**:
- Automatic CSS variable injection for chart colors
- Dark/light theme support
- Context-based configuration
- Responsive container

### Chart Configuration Pattern

```tsx
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",  // Always use CSS variables
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig
```

### Interactive Area Chart Example

**Location**: `components/chart-area-interactive.tsx`

**Key Patterns**:

1. **Responsive Controls**:
   - Desktop: `ToggleGroup` for time range selection (90d, 30d, 7d)
   - Mobile: `Select` dropdown (same options)
   - Toggle visibility with container queries: `@[767px]/card:flex` / `@[767px]/card:hidden`

2. **Linear Gradients**:
```tsx
<defs>
  <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="var(--color-desktop)" stopOpacity={1.0} />
    <stop offset="95%" stopColor="var(--color-desktop)" stopOpacity={0.1} />
  </linearGradient>
</defs>
```

3. **Chart Configuration**:
```tsx
<ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
  <AreaChart data={filteredData}>
    <CartesianGrid vertical={false} />
    <XAxis
      dataKey="date"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={32}
      tickFormatter={(value) => {
        const date = new Date(value)
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      }}
    />
    <ChartTooltip
      cursor={false}
      content={<ChartTooltipContent indicator="dot" />}
    />
    <Area
      dataKey="desktop"
      type="natural"
      fill="url(#fillDesktop)"
      stroke="var(--color-desktop)"
      stackId="a"
    />
  </AreaChart>
</ChartContainer>
```

4. **Card Container**:
- Wrap charts in `Card` component
- Use `@container/card` for responsive behavior
- Place controls in `CardAction` (top-right)

### Chart Styling Best Practices

- **Grid Lines**: `vertical={false}` for cleaner look
- **Axis**: Remove tick lines and axis lines for minimal style
- **Tooltips**: Use `cursor={false}` for cleaner hover state
- **Colors**: Always reference `var(--color-*)` from config
- **Indicator**: Use `"dot"` for area charts, `"line"` for line charts
- **Type**: Use `"natural"` for smooth curves, `"monotone"` for data accuracy

---

## Buttons & Interactive Elements

**Location**: `components/ui/button.tsx`

### Button Variants

```tsx
variant: {
  default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
  destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
  outline: 'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
}
```

### Button Sizes

```tsx
size: {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
  lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
  icon: 'size-9',
}
```

### Focus & Accessibility

All buttons include:
```tsx
className="focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
           aria-invalid:ring-destructive/20 aria-invalid:border-destructive
           disabled:pointer-events-none disabled:opacity-50"
```

### Icon Handling

- SVG icons are automatically sized: `[&_svg:not([class*='size-'])]:size-4`
- Icons never shrink: `[&_svg]:shrink-0`
- Icon-only buttons: Use `size="icon"` variant

### Usage Examples

```tsx
// Primary action
<Button>Save Changes</Button>

// Destructive action
<Button variant="destructive">Delete Account</Button>

// With icon
<Button>
  <IconPlus />
  <span>Add Item</span>
</Button>

// Icon only
<Button size="icon" variant="outline">
  <IconMail />
  <span className="sr-only">Inbox</span>
</Button>
```

---

## Cards & Containers

**Location**: `components/ui/card.tsx`

### Card Structure

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
    <CardAction>
      {/* Top-right actions (buttons, selects, etc.) */}
    </CardAction>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

### Card Styling

- **Container**: `rounded-xl border py-6 shadow-sm bg-card`
- **Gap**: `flex flex-col gap-6` (consistent spacing between sections)
- **Padding**: Horizontal padding (`px-6`) applied to Header, Content, Footer
- **Header Grid**: `grid-cols-[1fr_auto]` when CardAction is present (title left, action right)
- **Title**: `font-semibold leading-none`
- **Description**: `text-sm text-muted-foreground`

### Container Queries

Cards use `@container/card` for responsive behavior:

```tsx
<Card className="@container/card">
  <CardDescription>
    <span className="hidden @[540px]/card:block">Full text</span>
    <span className="@[540px]/card:hidden">Short text</span>
  </CardDescription>
</Card>
```

**Breakpoints**:
- `@[540px]/card`: Toggle content visibility
- `@[767px]/card`: Switch between ToggleGroup and Select

---

## Animations & Transitions

### Standard Animations (from `tw-animate-css`)

**Entrance/Exit**:
```tsx
className="data-[state=open]:animate-in data-[state=closed]:animate-out"
```

**Fade**:
```tsx
className="data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
```

**Zoom**:
```tsx
className="data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
```

**Slide**:
```tsx
className="slide-in-from-top-2"    // Slide from top
className="slide-in-from-bottom-2"  // Slide from bottom
className="slide-in-from-left-2"    // Slide from left
className="slide-in-from-right-2"   // Slide from right
```

### Duration

- **Standard**: `duration-200` (200ms) - used for most transitions
- **Sidebar**: `duration-200 ease-linear` - for width changes
- **Hover States**: `transition-all` or `transition-opacity`

### Opacity Transitions

```tsx
className="opacity-70 hover:opacity-100 transition-opacity"
```

### Example: Dialog Animation

```tsx
// Overlay
className="data-[state=open]:animate-in data-[state=closed]:animate-out
           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

// Content
className="data-[state=open]:animate-in data-[state=closed]:animate-out
           data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
           data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
           duration-200"
```

---

## Responsive Design Patterns

### Mobile-First Approach

Always start with mobile styles, then add desktop:

```tsx
<div className="px-2 sm:px-6">  {/* 8px mobile, 24px desktop */}
  <div className="text-sm md:text-base">  {/* Smaller text on mobile */}
    Content
  </div>
</div>
```

### Breakpoints (Tailwind defaults)

- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px
- `2xl:` - 1536px

### Container Queries (Modern Approach)

**Better than media queries** for component-level responsiveness:

```tsx
<Card className="@container/card">
  <div className="grid grid-cols-1 @5xl/card:grid-cols-4">
    {/* 1 column by default, 4 columns when card is 5xl wide */}
  </div>
</Card>
```

**Main container**:
```tsx
<div className="@container/main">
  <div className="@5xl/main:grid-cols-4">
    {/* Responds to main container width */}
  </div>
</div>
```

### Mobile Detection Hook

**Location**: `hooks/use-mobile.tsx`

```tsx
const isMobile = useIsMobile() // Returns true if width < 768px

// Use for conditional rendering
{isMobile ? <MobileComponent /> : <DesktopComponent />}
```

### Responsive Visibility

```tsx
<div className="hidden md:block">Desktop only</div>
<div className="block md:hidden">Mobile only</div>
```

### Sidebar Responsive Behavior

```tsx
// Hides when sidebar collapses
className="group-data-[collapsible=icon]:opacity-0"

// Sidebar wrapper states
className="group-data-[collapsible=icon]/sidebar-wrapper:*"
```

---

## Accessibility Features

### Focus Management

**Focus Rings** (consistent across all interactive elements):
```tsx
className="focus-visible:ring-ring/50 focus-visible:ring-[3px]
           focus-visible:border-ring outline-none"
```

**Ring Offset**:
```tsx
className="ring-offset-background focus:ring-offset-2"
```

### Invalid States

```tsx
className="aria-invalid:ring-destructive/20
           aria-invalid:border-destructive
           dark:aria-invalid:ring-destructive/40"
```

### Screen Reader Text

```tsx
<span className="sr-only">Close dialog</span>
```

### ARIA Support

- All dialogs have proper `DialogTitle` and `DialogDescription`
- Buttons include `aria-label` when icon-only
- Forms use proper `Label` associations
- Focus trapping in modals (Radix UI built-in)

### Keyboard Navigation

- Dialog close: ESC key
- Sidebar toggle: B key
- Tab navigation: Proper focus order
- Enter/Space: Button activation

### Disabled States

```tsx
className="disabled:pointer-events-none disabled:opacity-50"
```

---

## Code Patterns & Best Practices

### 1. Utility Function for Class Names

**Location**: `lib/utils.ts`

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Usage** (always use `cn()` for combining classes):
```tsx
<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  className  // Allow prop override
)} />
```

### 2. Client vs Server Components

**Server Components** (default):
- No "use client" directive
- Can fetch data directly
- Cannot use hooks or browser APIs

**Client Components** (when needed):
```tsx
"use client"  // Add at top of file

import { useState } from "react"
```

**When to use "use client"**:
- Using React hooks (useState, useEffect, etc.)
- Event handlers (onClick, onChange, etc.)
- Browser APIs (window, localStorage, etc.)
- Third-party libraries that use hooks

### 3. Data-Slot Pattern

All shadcn/ui components use `data-slot` attributes:

```tsx
<div data-slot="card">
  <div data-slot="card-header">
    <div data-slot="card-title">Title</div>
  </div>
</div>
```

**Benefits**:
- Easy styling with `data-[slot=name]` selectors
- Parent-child relationships: `has-data-[slot=card-action]`
- State-based styling: `data-[state=open]`

### 4. Component Composition

Prefer composition over complex props:

```tsx
// ✅ Good - Composable
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardAction><Button>Action</Button></CardAction>
  </CardHeader>
</Card>

// ❌ Bad - Props hell
<Card
  title="Title"
  action={<Button>Action</Button>}
  showHeader={true}
/>
```

### 5. Type Safety

Use TypeScript for all components:

```tsx
import * as React from 'react'

function MyComponent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn("base", className)} {...props} />
}
```

### 6. Conditional Rendering

```tsx
// ✅ Good - Clear intent
{isMobile && <MobileComponent />}
{!isMobile && <DesktopComponent />}

// ✅ Good - Ternary for either/or
{isMobile ? <MobileVersion /> : <DesktopVersion />}

// ❌ Avoid - Complex nested ternaries
{loading ? <Spinner /> : error ? <Error /> : data ? <Content /> : null}
```

### 7. Form Patterns

Use React Hook Form + Zod:

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
})

const form = useForm({
  resolver: zodResolver(schema),
})
```

### 8. Toast Notifications

**Location**: `hooks/use-toast.ts`

```tsx
import { toast } from "sonner"

// Success
toast.success("Changes saved successfully")

// Error
toast.error("Failed to save changes")

// Loading with promise
toast.promise(apiCall(), {
  loading: "Saving changes...",
  success: "Changes saved!",
  error: "Failed to save changes",
})
```

### 9. Icon Usage

**Tabler Icons** (primary):
```tsx
import { IconDashboard, IconSettings } from "@tabler/icons-react"

<IconDashboard />  // Default size
<IconDashboard className="!size-5" />  // Custom size
```

**Lucide Icons** (system/shadcn):
```tsx
import { XIcon, ChevronDownIcon } from "lucide-react"

<XIcon />  // Automatically sized by parent
```

### 10. Dark Mode Styling

Use the `dark:` variant for dark mode overrides:

```tsx
<div className="bg-white dark:bg-black
                text-black dark:text-white">
  Content
</div>
```

**Prefer CSS variables** over direct dark mode classes when possible:
```tsx
// ✅ Better - automatically theme-aware
<div className="bg-background text-foreground">

// ❌ Less maintainable
<div className="bg-white dark:bg-black text-black dark:text-white">
```

---

## Component Usage Checklist

When building new components, ensure:

- [ ] Uses semantic CSS variables (`--primary`, `--foreground`, etc.)
- [ ] Includes `cn()` utility for className merging
- [ ] Has proper TypeScript types (`React.ComponentProps<'element'>`)
- [ ] Includes `data-slot` attribute for styling hooks
- [ ] Spreads `...props` for extensibility
- [ ] Uses proper focus styles (`focus-visible:ring-*`)
- [ ] Has accessible text for screen readers (`sr-only` when needed)
- [ ] Supports both light and dark modes
- [ ] Uses container queries for responsive behavior (where applicable)
- [ ] Follows mobile-first responsive patterns
- [ ] Has proper disabled and invalid states
- [ ] Uses consistent animations (`animate-in/out` with 200ms duration)
- [ ] Icons are from Tabler (app icons) or Lucide (system icons)
- [ ] Forms use React Hook Form + Zod validation
- [ ] Toast notifications use Sonner
- [ ] Modals use Dialog (desktop) or Drawer (mobile)

---

## File Organization

```
app/
├── layout.tsx          # Root layout with fonts & ThemeProvider
├── globals.css         # All CSS variables and theme definitions
└── dashboard/          # Feature pages
    └── page.tsx

components/
├── ui/                 # shadcn/ui components (50+ components)
├── app-sidebar.tsx     # Main sidebar
├── nav-*.tsx          # Navigation components
├── chart-*.tsx        # Chart components
├── data-table.tsx     # Table components
└── theme-provider.tsx # Theme context

hooks/
├── use-mobile.tsx     # Mobile detection
└── use-toast.ts       # Toast notifications

lib/
└── utils.ts           # cn() utility
```

---

## Quick Reference

### Most Common Patterns

**Card with Chart**:
```tsx
<Card className="@container/card">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardAction><Select>...</Select></CardAction>
  </CardHeader>
  <CardContent>
    <ChartContainer config={chartConfig}>
      <AreaChart data={data}>...</AreaChart>
    </ChartContainer>
  </CardContent>
</Card>
```

**Responsive Dialog/Drawer**:
```tsx
const isMobile = useIsMobile()
{isMobile ? (
  <Drawer>
    <DrawerContent>...</DrawerContent>
  </Drawer>
) : (
  <Dialog>
    <DialogContent>...</DialogContent>
  </Dialog>
)}
```

**Button with Icon**:
```tsx
<Button>
  <IconPlus />
  <span>Add Item</span>
</Button>
```

**Sidebar Menu Item**:
```tsx
<SidebarMenuItem>
  <SidebarMenuButton tooltip="Dashboard">
    <IconDashboard />
    <span>Dashboard</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

---

## Design Principles

1. **Consistency**: Use the same patterns across the app (colors, spacing, animations)
2. **Accessibility First**: Always include focus states, ARIA labels, and keyboard navigation
3. **Mobile-First**: Start with mobile styles, enhance for desktop
4. **Performance**: Use CSS variables for theming (no runtime recalculation)
5. **Composition**: Build complex UIs from simple, reusable components
6. **Type Safety**: TypeScript for everything
7. **Semantic Markup**: Use proper HTML elements and ARIA roles
8. **Dark Mode**: Support both light and dark themes from the start
9. **Container Queries**: Use for component-level responsiveness
10. **Progressive Enhancement**: Works without JavaScript where possible

---

## Additional Resources

- **shadcn/ui docs**: https://ui.shadcn.com
- **Radix UI docs**: https://www.radix-ui.com
- **Tailwind CSS docs**: https://tailwindcss.com
- **Recharts docs**: https://recharts.org
- **Tabler Icons**: https://tabler.io/icons
- **Lucide Icons**: https://lucide.dev

---

**Last Updated**: Based on codebase analysis on 2025-10-20

**Note**: This document is a living reference. Update it when introducing new patterns or making significant style changes.
