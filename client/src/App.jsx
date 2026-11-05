import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { DineProvider } from './context/DineContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RouteFx from './components/fx/RouteFx';
import Splash from './components/fx/Splash';
import useRevealObserver from './hooks/useRevealObserver';

import Landing from './pages/public/Landing';
import Menu from './pages/public/Menu';
import Cart from './pages/public/Cart';
import Pay from './pages/public/Pay';
import OrderSuccess from './pages/public/OrderSuccess';
import MyOrders from './pages/public/MyOrders';
import Login from './pages/public/Login';
import Signup from './pages/public/Signup';
import ForgotPassword from './pages/public/ForgotPassword';

import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import MenuManager from './pages/admin/MenuManager';
import Categories from './pages/admin/Categories';
import Users from './pages/admin/Users';
import Customers from './pages/admin/Customers';
import Settings from './pages/admin/Settings';
import SalesReport from './pages/admin/SalesReport';
import BestSellers from './pages/admin/BestSellers';
import ActivityLog from './pages/admin/ActivityLog';
import Kitchen from './pages/admin/Kitchen';
import FrontDesk from './pages/admin/FrontDesk';
import Tables from './pages/admin/Tables';

import DineStart from './pages/dine/DineStart';
import DineLayout from './pages/dine/DineLayout';
import DineMenu from './pages/dine/DineMenu';
import DineCart from './pages/dine/DineCart';
import DineBill from './pages/dine/DineBill';
import DinePay from './pages/dine/DinePay';

const adminOnly = (el) => <ProtectedRoute roles={['admin']}>{el}</ProtectedRoute>;
const customerOnly = (el) => <ProtectedRoute roles={['customer']}>{el}</ProtectedRoute>;

export default function App() {
  useRevealObserver();

  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <DineProvider>
              <Splash />
              <RouteFx>
                <Routes>
                  <Route path="/" element={<Landing />} />

                  {/* Public: browse the menu, log in, sign up */}
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

                  {/* Customer pages: ordering needs an account */}
                  <Route path="/cart" element={customerOnly(<Cart />)} />
                  <Route path="/pay/:id" element={customerOnly(<Pay />)} />
                  <Route path="/order-success/:id" element={customerOnly(<OrderSuccess />)} />
                  <Route path="/orders" element={customerOnly(<MyOrders />)} />

                  {/* In-restaurant app from the table QR codes: no login, separate from delivery */}
                  <Route path="/t/:tableToken" element={<DineStart />} />
                  <Route path="/dine" element={<DineLayout />}>
                    <Route index element={<DineMenu />} />
                    <Route path="cart" element={<DineCart />} />
                    <Route path="bill" element={<DineBill />} />
                    <Route path="pay" element={<DinePay />} />
                  </Route>

                  {/* Staff + admin area */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute roles={['admin', 'staff']}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="kitchen" element={<Kitchen />} />
                    <Route path="front-desk" element={<FrontDesk />} />
                    <Route path="tables" element={adminOnly(<Tables />)} />
                    <Route path="menu" element={adminOnly(<MenuManager />)} />
                    <Route path="categories" element={adminOnly(<Categories />)} />
                    <Route path="users" element={adminOnly(<Users />)} />
                    <Route path="customers" element={adminOnly(<Customers />)} />
                    <Route path="settings" element={adminOnly(<Settings />)} />
                    <Route path="reports/sales" element={adminOnly(<SalesReport />)} />
                    <Route path="reports/best-sellers" element={adminOnly(<BestSellers />)} />
                    <Route path="activity" element={adminOnly(<ActivityLog />)} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </RouteFx>
            </DineProvider>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
