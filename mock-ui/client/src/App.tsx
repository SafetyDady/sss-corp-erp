import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Me from "./pages/Me";
import SupplyChain from "./pages/SupplyChain";
import WorkOrders from "./pages/WorkOrders";
import Purchasing from "./pages/Purchasing";
import Sales from "./pages/Sales";
import HR from "./pages/HR";
import Finance from "./pages/Finance";
import Customers from "./pages/Customers";
import Planning from "./pages/Planning";
import MasterData from "./pages/MasterData";
import Admin from "./pages/Admin";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/me" component={Me} />
        <Route path="/supply-chain" component={SupplyChain} />
        <Route path="/work-orders" component={WorkOrders} />
        <Route path="/purchasing" component={Purchasing} />
        <Route path="/sales" component={Sales} />
        <Route path="/hr" component={HR} />
        <Route path="/finance" component={Finance} />
        <Route path="/customers" component={Customers} />
        <Route path="/planning" component={Planning} />
        <Route path="/master-data" component={MasterData} />
        <Route path="/admin" component={Admin} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
