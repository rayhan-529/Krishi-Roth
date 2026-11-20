/**
 * All pages and who may open them.
 * Page access here is for convenience; the API checks every permission again.
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBox, Loader } from './components/ui'
import { useAuth } from './context/AuthContext'
import { useLookups } from './context/LookupsContext'
import { HOME_BY_ROLE, PROVIDER_ROLES } from './utils/nav'

// Public
const Home = lazy(() => import('./pages/public/Home'))
const About = lazy(() => import('./pages/public/About'))
const Weather = lazy(() => import('./pages/public/Weather'))
const Privacy = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Terms })))
const NotFound = lazy(() => import('./pages/public/NotFound'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const LoginLink = lazy(() => import('./pages/auth/LoginLink'))
const TwoFactorLogin = lazy(() => import('./pages/auth/TwoFactorLogin'))
const MarketPrices = lazy(() => import('./pages/market/MarketPrices'))
const Marketplace = lazy(() => import('./pages/market/Marketplace'))
const ListingDetails = lazy(() => import('./pages/market/ListingDetails'))
const LabourSearch = lazy(() => import('./pages/services/LabourSearch'))
const MachineryRental = lazy(() => import('./pages/services/MachineryRental'))
const TransportServices = lazy(() => import('./pages/services/TransportServices'))
const PublicProfile = lazy(() => import('./pages/shared/PublicProfile'))
const Chatbot = lazy(() => import('./pages/shared/Chatbot'))

// Farmer
const FarmerDashboard = lazy(() => import('./pages/farmer/FarmerDashboard'))
const MyListings = lazy(() => import('./pages/farmer/MyListings'))
const ListingForm = lazy(() => import('./pages/farmer/ListingForm'))
const Harvests = lazy(() => import('./pages/farmer/Harvests'))
const Notebooks = lazy(() => import('./pages/farmer/Notebooks'))
const NotebookEditor = lazy(() => import('./pages/farmer/NotebookEditor'))

// Buyer and providers
const BuyerDashboard = lazy(() => import('./pages/buyer/BuyerDashboard'))
const ProviderDashboard = lazy(() => import('./pages/provider/ProviderDashboard'))
const MyServices = lazy(() => import('./pages/provider/MyServices'))

// Shared (logged in)
const Offers = lazy(() => import('./pages/shared/Offers'))
const Trades = lazy(() => import('./pages/shared/Trades'))
const Wallet = lazy(() => import('./pages/shared/Wallet'))
const AdminWallet = lazy(() => import('./pages/admin/AdminWallet'))
const TradeDetails = lazy(() => import('./pages/shared/TradeDetails'))
const Bookings = lazy(() => import('./pages/shared/Bookings'))
const BookingDetails = lazy(() => import('./pages/shared/BookingDetails'))
const Messages = lazy(() => import('./pages/shared/Messages'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Profile = lazy(() => import('./pages/shared/Profile'))
const Complaints = lazy(() => import('./pages/shared/Complaints'))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'))
const AdminCrops = lazy(() => import('./pages/admin/AdminCrops'))
const AdminMarketPrices = lazy(() => import('./pages/admin/AdminMarketPrices'))
const AdminTrades = lazy(() => import('./pages/admin/AdminTrades'))
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'))
const AdminComplaints = lazy(() => import('./pages/admin/AdminComplaints'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'))
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))

/** Sends a logged-in user to their own dashboard. */
function DashboardRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />
}

export default function App() {
  const lookups = useLookups()

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<Layout />}>
          {lookups.error ? (
            <Route path="*" element={<div className="page"><ErrorBox error={lookups.error} onRetry={lookups.retry} /></div>} />
          ) : (
            <>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="weather" element={<Weather />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="login" element={<Login />} />
              <Route path="admin/login" element={<Navigate to="/login" replace />} />
              <Route path="register" element={<Register />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="login/link" element={<LoginLink />} />
              <Route path="login/verify" element={<TwoFactorLogin />} />
              <Route path="market-prices" element={<MarketPrices />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="listings/:id" element={<ListingDetails />} />
              <Route path="services/labour" element={<LabourSearch />} />
              <Route path="services/harvester" element={<MachineryRental type="harvester" />} />
              <Route path="services/tractor" element={<MachineryRental type="tractor" />} />
              <Route path="services/transport" element={<TransportServices />} />
              <Route path="users/:id" element={<PublicProfile />} />
              <Route path="chatbot" element={<Chatbot />} />
              <Route path="dashboard" element={<DashboardRedirect />} />

              <Route element={<ProtectedRoute roles={['farmer']} />}>
                <Route path="farmer" element={<FarmerDashboard />} />
                <Route path="farmer/listings" element={<MyListings />} />
                <Route path="farmer/listings/new" element={<ListingForm />} />
                <Route path="farmer/listings/:id/edit" element={<ListingForm />} />
                <Route path="farmer/harvests" element={<Harvests />} />
                <Route path="farmer/notebooks" element={<Notebooks />} />
                <Route path="farmer/notebooks/:id" element={<NotebookEditor />} />
              </Route>

              <Route element={<ProtectedRoute roles={['buyer']} />}>
                <Route path="buyer" element={<BuyerDashboard />} />
              </Route>

              <Route element={<ProtectedRoute roles={PROVIDER_ROLES} />}>
                <Route path="provider" element={<ProviderDashboard />} />
                <Route path="provider/services" element={<MyServices />} />
              </Route>

              <Route element={<ProtectedRoute roles={['farmer', 'buyer']} />}>
                <Route path="offers" element={<Offers />} />
                <Route path="trades" element={<Trades />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="messages" element={<Messages />} />
                <Route path="messages/:id" element={<Messages />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route path="trades/:id" element={<TradeDetails />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="bookings/:id" element={<BookingDetails />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />
                <Route path="complaints" element={<Complaints />} />
              </Route>

              <Route path="admin" element={<ProtectedRoute roles={['admin']} />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="verifications" element={<AdminVerifications />} />
                <Route path="crops" element={<AdminCrops />} />
                <Route path="market-prices" element={<AdminMarketPrices />} />
                <Route path="trades" element={<AdminTrades />} />
                <Route path="wallet" element={<AdminWallet />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="complaints" element={<AdminComplaints />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </>
          )}
        </Route>
      </Routes>
    </Suspense>
  )
}
