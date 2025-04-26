import React, { useState, useEffect, useCallback } from 'react';
import {
  auth,
  db,
  storage,
  getPaymentDetails,
  createPortalSession,
  getSearchLimit,
  getSearchesUsed,
  incrementSearchCount,
} from './firebase';
import { updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Button,
  Form,
  Alert,
  Card,
  ProgressBar,
  Badge,
  Container,
  Row,
  Col,
  Tabs,
  Tab,
  Tooltip,
  OverlayTrigger,
  Modal,
  InputGroup,
  ListGroup,
  Image,
  Table,
  Spinner,
  Nav,
} from 'react-bootstrap';
import {
  FaUser,
  FaLock,
  FaPhone,
  FaCrown,
  FaSearch,
  FaInfoCircle,
  FaSave,
  FaCamera,
  FaTrash,
  FaCheckCircle,
  FaHistory,
  FaBell,
  FaShieldAlt,
  FaCalendarAlt,
  FaPencilAlt,
  FaSignOutAlt,
  FaCog,
  FaChartLine,
  FaKey,
  FaIdCard,
  FaLockOpen,
  FaFingerprint,
  FaExclamationTriangle,
  FaEnvelope,
  FaCheck,
  FaCreditCard,
  FaReceipt,
  FaFileInvoiceDollar,
  FaDollarSign,
  FaPlus,
  FaShoppingCart,
  FaTags,
  FaUserCircle,
  FaSearchDollar,
  FaBrain,
  FaCode,
  FaHeadset,
  FaFileExport,
} from 'react-icons/fa';
import Pricing from './Pricing'; // Import the Pricing component

// Inline CSS from your provided styles, with footer styles removed
const GlobalStyles = () => (
  <style>
    {`
      /* Your provided CSS styles */
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      #root {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      /* === UserAccount Component Specific Styling === */
      /* UserAccount Layout */
      .user-account-container {
        padding: 2rem 0;
        flex: 1 0 auto; /* Ensure it expands to push global footer down */
      }

      /* UserAccount Cards */
      .user-account-card {
        background-color: var(--profile-card-bg);
        border: none;
        border-radius: 12px;
        box-shadow: var(--profile-card-shadow);
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .user-account-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 30px rgba(var(--accent-color-rgb), 0.1);
      }

      /* Make sure all text in the user account container is visible in all themes */
      .user-account-container {
        color: var(--text-color);
      }
      
      .user-account-container p,
      .user-account-container span,
      .user-account-container div,
      .user-account-container h1,
      .user-account-container h2,
      .user-account-container h3,
      .user-account-container h4,
      .user-account-container h5,
      .user-account-container h6,
      .user-account-container small {
        color: var(--text-color);
      }

      /* Fix specifically for emails, dates, and other important info */
      .user-email,
      .email-display,
      .user-account-container .email,
      .user-info .email,
      .profile-email,
      .account-info .email {
        color: var(--accent-color) !important;
        font-weight: 500;
      }
      
      /* If the email appears in a list-group-item */
      .list-group-item .email-value,
      .list-group-item strong,
      .user-account-container .list-group-item .text-value {
        color: var(--accent-color) !important;
        font-weight: 500;
      }

      /* Fix specifically for dates like "Member since" */
      .member-since-date,
      .user-account-container .text-muted,
      .user-account-card .text-muted {
        color: var(--muted-paragraph-color) !important;
        opacity: 0.8;
      }

      /* Form Controls in UserAccount */
      .user-account-container .form-control,
      .user-account-container .form-select,
      .user-account-container .input-group-text {
        background-color: var(--form-control-bg);
        border-color: var(--form-control-border);
        color: var(--text-color);
        border-radius: 0.375rem;
        padding: 0.5rem 1rem;
        transition: all 0.2s ease;
      }

      .user-account-container .form-control:focus,
      .user-account-container .form-select:focus {
        border-color: var(--form-control-focus-border);
        box-shadow: var(--form-control-focus-shadow);
        outline: none;
      }

      .user-account-container .form-label {
        color: var(--form-label-color);
        font-weight: 500;
        margin-bottom: 0.5rem;
      }

      /* Avatar Container */
      .avatar-container {
        position: relative;
        width: 130px;
        height: 130px;
        margin: 0 auto;
        border-radius: 50%;
        overflow: hidden;
        border: 3px solid var(--card-bg);
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        background-color: var(--avatar-bg);
        transition: all 0.3s ease;
      }

      .avatar-container img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .camera-button {
        position: absolute;
        bottom: 5px;
        right: 5px;
        background-color: var(--card-bg);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--border-color);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        opacity: 0.7;
        transform: translateY(5px);
      }

      .avatar-container:hover .camera-button {
        opacity: 1;
        transform: translateY(0);
      }

      .camera-button:hover {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        color: white;
      }

      /* User Information List */
      .user-account-container .list-group-item {
        background-color: transparent;
        border-color: var(--border-color);
        color: var(--text-color);
        padding: 0.75rem 0;
      }

      /* Ensure user info fields like email and username are visible */
      .user-info-field,
      .profile-info-value,
      .account-detail-value {
        color: var(--accent-color) !important;
        font-weight: 500;
      }

      /* Tab Navigation */
      .user-account-container .nav-tabs {
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
      }

      .user-account-container .nav-tabs .nav-link {
        color: var(--text-color);
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        padding: 0.75rem 1.25rem;
        font-weight: 500;
        transition: all 0.3s ease;
      }

      .user-account-container .nav-tabs .nav-link:hover {
        border-color: var(--accent-color);
        color: var(--accent-color);
      }

      .user-account-container .nav-tabs .nav-link.active {
        border-color: var(--accent-color);
        color: var(--accent-color);
        background-color: transparent;
        font-weight: 600;
      }

      /* Tab Content */
      .user-account-container .tab-content {
        color: var(--text-color) !important;
      }

      /* High-contrast adjustments for notification tab */
      #notifications {
        color: #FFFF00 !important; /* Bright yellow for high contrast */
      }
      
      /* Payment sub-tabs styling */
      .user-account-container .nav-pills .nav-link {
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .user-account-container .nav-pills .nav-link.active {
        background-color: var(--accent-color);
        color: white;
      }
      
      /* Pricing when embedded in user account */
      .pricing-wrapper .card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      
      .pricing-wrapper .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      }
      
      /* Buy credits button */
      .buy-credits-btn {
        margin-left: auto;
        border-radius: 50px;
        font-weight: 500;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background-color: var(--accent-color);
        color: white;
        border: none;
        transition: all 0.3s ease;
        margin-bottom: 2px; /* Align with tabs */
      }
      
      .buy-credits-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        background-color: var(--accent-color-hover);
      }
      
      .buy-credits-btn .search-count {
        background-color: rgba(255,255,255,0.25);
        border-radius: 50px;
        padding: 0.15rem 0.5rem;
        font-size: 0.75rem;
        margin-left: 0.5rem;
      }
      
      .credits-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .notification-badge {
        position: relative;
      }
      
      .notification-badge .badge {
        position: absolute;
        top: -8px;
        right: -8px;
        border-radius: 50%;
        font-size: 0.65rem;
        min-width: 18px;
        height: 18px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Quick buy styling */
      .search-count-icon {
        position: relative;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: rgba(13, 110, 253, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }
      
      .search-count-number {
        position: absolute;
        top: -5px;
        right: -5px;
        background-color: #0d6efd;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
      }
      
      .popular-plan {
        position: relative;
        transform: scale(1.05);
        z-index: 1;
      }
      
      .popular-badge {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2;
      }
      
      .price {
        font-size: 1.5rem;
        font-weight: bold;
        color: var(--accent-color);
      }
      
      /* Timeline styling */
      .timeline-circle {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: var(--accent-color);
        position: absolute;
        left: -20px;
        top: 6px;
      }
      
      .timeline-item {
        position: relative;
        padding-left: 20px;
        border-left: 2px solid var(--border-color);
      }
      
      @media (max-width: 768px) {
        .buy-credits-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        
        .user-account-container .nav-tabs {
          justify-content: space-between;
        }
        
        .popular-plan {
          transform: none;
        }
      }
    `}
  </style>
);

const UserAccount = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // User data states
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [membership, setMembership] = useState('Free');
  const [searchLimit, setSearchLimit] = useState(0);
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);

  // Payment data states
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [lastPayment, setLastPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [paymentActiveTab, setPaymentActiveTab] = useState('history'); // Added for payment subtabs
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityHistory, setActivityHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [selectedTimeout, setSelectedTimeout] = useState('60');
  const [showBuySearchModal, setShowBuySearchModal] = useState(false);

  const user = auth.currentUser;

  // Check if URL has tab parameter to set the active tab
  useEffect(() => {
    const path = location.pathname.split('/');
    const tabFromUrl = path[path.length - 1];
    if (tabFromUrl === 'payments') {
      setActiveTab('payments');
      // Optionally focus on the pricing tab
      if (searchParams.get('showPricing') === 'true') {
        setPaymentActiveTab('pricing');
      }
    }
  }, [location.pathname, searchParams]);

  // Check for payment success from URL parameters after Stripe redirect
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment_success');
    const plan = searchParams.get('plan');

    if (paymentSuccess === 'true' && plan) {
      setSuccess(
        `Payment successful! Your account has been credited with additional searches.`
      );

      // Clear the URL parameters
      navigate('/user-account', { replace: true });

      // Refresh user data to show updated search limits
      fetchUserData();

      // Set active tab to payments to show the updated search credits
      setActiveTab('payments');
    }
  }, [searchParams, navigate]);

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) return;

      // Get basic user data from Firestore
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        setEmail(user.email || '');
        setDisplayName(user.displayName || '');
        setPhone(userData.phone || '');
        setMembership(userData.membership || 'Free');
        setSearchLimit(userData.searchLimit || 0);
        setSearchesUsed(userData.searchesUsed || 0);
        setProfilePhoto(user.photoURL || null);
        setCreatedAt(
          user.metadata.creationTime
            ? new Date(user.metadata.creationTime)
            : null
        );
        setLastLogin(
          user.metadata.lastSignInTime
            ? new Date(user.metadata.lastSignInTime)
            : null
        );

        if (userData.activityHistory) {
          setActivityHistory(userData.activityHistory.slice(0, 10));
        }

        if (userData.notifications) {
          setNotifications(userData.notifications.slice(0, 5));
        } else {
          // If no notifications in database, create some sample ones for UI testing
          setNotifications([
            {
              title: 'Welcome to Your Account',
              message:
                'Thank you for creating an account. Start exploring vehicle history reports now!',
              timestamp: new Date(),
              type: 'success',
            },
            {
              title: 'Search Credits Low',
              message:
                "You're running low on search credits. Consider purchasing more to continue your research.",
              timestamp: new Date(Date.now() - 86400000), // Yesterday
              type: 'warning',
            },
          ]);
        }
      }

      // Try to get search limit and usage from your existing exported functions
      try {
        const limit = await getSearchLimit();
        const used = await getSearchesUsed();

        if (limit !== undefined && limit !== null) {
          setSearchLimit(limit);
        }

        if (used !== undefined && used !== null) {
          setSearchesUsed(used);
        }
      } catch (err) {
        console.error('Error checking search credits:', err);
      }

      // Fetch payment history using the updated getPaymentDetails function
      try {
        const paymentResult = await getPaymentDetails();
        if (paymentResult && paymentResult.data) {
          setPaymentHistory(paymentResult.data.paymentHistory || []);
          setLastPayment(paymentResult.data.lastPayment || null);

          // Update search limits if available from payment data
          if (paymentResult.data.searchLimit) {
            setSearchLimit(paymentResult.data.searchLimit);
          }
          if (paymentResult.data.searchesUsed) {
            setSearchesUsed(paymentResult.data.searchesUsed);
          }
        }
      } catch (err) {
        console.error('Error fetching payment data:', err);
      }

      // Check for customer data in Firestore (from Firebase Extension)
      try {
        // Look for 'customers' collection data
        const customerRef = doc(db, 'customers', user.uid);
        const customerDoc = await getDoc(customerRef);

        if (customerDoc.exists()) {
          // Get payment history from the payments subcollection
          const paymentsRef = collection(db, 'customers', user.uid, 'payments');
          const paymentsQuery = query(
            paymentsRef,
            orderBy('created', 'desc'),
            limit(10)
          );

          const paymentsSnapshot = await getDocs(paymentsQuery);

          if (!paymentsSnapshot.empty) {
            const payments = [];
            paymentsSnapshot.forEach((doc) => {
              // Format payment data to match our UI requirements
              const paymentData = doc.data();
              payments.push({
                id: doc.id,
                paymentId: paymentData.id || doc.id,
                date: new Date(paymentData.created * 1000), // Convert Unix timestamp
                amount: (paymentData.amount || 0) / 100, // Convert cents to dollars
                productName:
                  paymentData.metadata?.productName || 'VIN Search Credits',
                searchesAdded: parseInt(
                  paymentData.metadata?.searchCredits || '0',
                  10
                ),
                status: paymentData.status || 'succeeded',
              });
            });

            if (payments.length > 0) {
              setPaymentHistory(payments);
              setLastPayment(payments[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching customer payment data:', err);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Error loading user data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password)) strength += 25;

    setPasswordStrength(strength);
  }, [password]);

  const calculateRemainingSearches = useCallback(() => {
    return searchLimit - searchesUsed;
  }, [searchLimit, searchesUsed]);

  const validateForm = useCallback(() => {
    setError('');
    if (displayName?.trim() === '') {
      setError('Display name cannot be empty');
      return false;
    }
    if (password) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }
    if (phone && !/^\+?[\d\s-()]{10,15}$/.test(phone)) {
      setError('Please enter a valid phone number');
      return false;
    }
    return true;
  }, [displayName, password, confirmPassword, phone]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      try {
        setLoading(true);
        const updates = {};

        if (displayName !== user.displayName) {
          await updateProfile(user, { displayName });
          updates.displayName = displayName;
        }

        if (email !== user.email) {
          await updateEmail(user, email);
          updates.email = email;
        }

        if (password) {
          await updatePassword(user, password);
        }

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          ...updates,
          phone,
          membership: membership.toLowerCase(),
          lastUpdated: serverTimestamp(),
          activityHistory: [
            {
              action: 'profile_update',
              timestamp: new Date().toISOString(),
              details: 'Updated profile information',
            },
            ...(activityHistory || []),
          ],
        });

        setSuccess('Profile updated successfully!');
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        console.error('Profile update error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [displayName, email, password, phone, membership, user, activityHistory]
  );

  const handlePhotoChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.match('image.*')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be smaller than 5MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target.result);
      reader.readAsDataURL(file);
      setShowPhotoModal(true);
    }
  }, []);

  const uploadProfilePhoto = useCallback(async () => {
    if (!photoFile) return;

    try {
      setLoading(true);
      const timestamp = new Date().getTime();
      const uniqueFilename = `profile-photos/${user.uid}_${timestamp}`;
      const fileRef = ref(storage, uniqueFilename);
      const metadata = {
        contentType: photoFile.type,
        customMetadata: {
          userId: user.uid,
          uploadTime: timestamp.toString(),
        },
      };
      await uploadBytes(fileRef, photoFile, metadata);
      const photoURL = await getDownloadURL(fileRef);
      await updateProfile(user, { photoURL });
      setProfilePhoto(photoURL);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        profilePhoto: photoURL,
        activityHistory: [
          {
            action: 'photo_update',
            timestamp: new Date().toISOString(),
            details: 'Updated profile photo',
          },
          ...(activityHistory || []),
        ],
      });

      setShowPhotoModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setSuccess('Profile photo updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Photo upload error:', err);
      setError('Failed to upload profile photo: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [photoFile, user, activityHistory]);

  const getMembershipColor = useCallback(() => {
    switch (membership.toLowerCase()) {
      case 'premium':
        return 'warning';
      case 'business':
        return 'info';
      case 'enterprise':
        return 'danger';
      default:
        return 'secondary';
    }
  }, [membership]);

  const getSearchUsagePercentage = useCallback(() => {
    if (!searchLimit) return 0;
    return (searchesUsed / searchLimit) * 100;
  }, [searchesUsed, searchLimit]);

  const getPasswordStrengthColor = useCallback(() => {
    if (passwordStrength < 50) return 'danger';
    if (passwordStrength < 75) return 'warning';
    return 'success';
  }, [passwordStrength]);

  const renderTooltip = useCallback(
    (props, content) => (
      <Tooltip id="button-tooltip" {...props}>
        {content}
      </Tooltip>
    ),
    []
  );

  const formatDate = useCallback((date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Function to handle the purchase of more searches
  const handlePurchaseMore = useCallback(() => {
    setShowBuySearchModal(true);
  }, []);

  // Function to view payment details
  const handleViewPayment = useCallback((payment) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  }, []);

  // Function to handle opening Stripe Customer Portal
  const handleManagePaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      const result = await createPortalSession();
      if (result && result.data && result.data.url) {
        window.location.assign(result.data.url);
      } else {
        throw new Error('Failed to create portal session');
      }
    } catch (err) {
      console.error('Error creating portal session:', err);
      setError('Failed to open customer portal: ' + err.message);
      setLoading(false);
    }
  }, []);

  // Function to navigate to payments tab for buying searches
  const goToPricingTab = useCallback(() => {
    setActiveTab('payments');
    setPaymentActiveTab('pricing');
    setShowBuySearchModal(false);
  }, []);

  if (loading && !email) {
    return (
      <Container
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="text-center">
          <div className="spinner-grow text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-primary fw-bold">Loading your profile...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="d-flex flex-column min-vh-100">
        <main className="user-account-container">
          <Container>
            <Row className="mb-4">
              <Col>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h1 className="display-6 fw-bold">My Account</h1>
                    <p className="text-muted">
                      Today is{' '}
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Badge
                    bg={getMembershipColor()}
                    className="membership-badge d-none d-md-block"
                  >
                    <FaCrown className="me-2" />
                    {membership.charAt(0).toUpperCase() +
                      membership.slice(1)}{' '}
                    Member
                  </Badge>
                </div>
              </Col>
            </Row>

            {error && (
              <Alert
                variant="danger"
                className="alert mb-4 d-flex align-items-center"
              >
                <FaExclamationTriangle className="me-2 flex-shrink-0" />
                <div>{error}</div>
                <Button
                  variant="link"
                  className="ms-auto p-0 text-danger"
                  onClick={() => setError('')}
                  aria-label="Close alert"
                >
                  <span aria-hidden="true">×</span>
                </Button>
              </Alert>
            )}

            {success && (
              <Alert
                variant="success"
                className="alert mb-4 d-flex align-items-center"
              >
                <FaCheckCircle className="me-2 flex-shrink-0" />
                <div>{success}</div>
                <Button
                  variant="link"
                  className="ms-auto p-0 text-success"
                  onClick={() => setSuccess('')}
                  aria-label="Close alert"
                >
                  <span aria-hidden="true">×</span>
                </Button>
              </Alert>
            )}

            <Row className="g-4">
              <Col lg={4} className="mb-4">
                <Card className="user-account-card dashboard-card">
                  <Card.Body className="text-center p-4">
                    <div className="avatar-container">
                      {profilePhoto ? (
                        <Image
                          src={profilePhoto}
                          alt={displayName || email}
                          roundedCircle
                          loading="lazy"
                        />
                      ) : (
                        <div className="d-flex align-items-center justify-content-center h-100 bg-light">
                          <FaUserCircle size={50} className="text-secondary" />
                        </div>
                      )}
                      <div
                        className="camera-button"
                        onClick={() =>
                          document.getElementById('photo-upload').click()
                        }
                        title="Change profile photo"
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e) =>
                          e.key === 'Enter' &&
                          document.getElementById('photo-upload').click()
                        }
                      >
                        <FaCamera className="text-primary" />
                        <input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          className="d-none"
                          onChange={handlePhotoChange}
                          aria-label="Upload profile photo"
                        />
                      </div>
                    </div>

                    <h4 className="mt-3 mb-1">
                      {displayName || 'Set Your Name'}
                    </h4>
                    <p className="text-muted mb-3">{email}</p>

                    <Badge
                      bg={getMembershipColor()}
                      className="membership-badge d-block d-md-none mb-3"
                    >
                      <FaCrown className="me-2" />
                      {membership.charAt(0).toUpperCase() +
                        membership.slice(1)}{' '}
                      Member
                    </Badge>

                    <div className="mt-3">
                      <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex justify-content-between align-items-center border-0 px-0 py-2">
                          <div className="d-flex align-items-center">
                            <div className="settings-icon-container">
                              <FaCalendarAlt className="settings-icon" />
                            </div>
                            <span>Member Since</span>
                          </div>
                          <span className="text-muted">
                            {formatDate(createdAt)}
                          </span>
                        </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-center border-0 px-0 py-2">
                          <div className="d-flex align-items-center">
                            <div className="settings-icon-container">
                              <FaHistory className="settings-icon" />
                            </div>
                            <span>Last Login</span>
                          </div>
                          <span className="text-muted">
                            {formatDate(lastLogin)}
                          </span>
                        </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-center border-0 px-0 py-2">
                          <div className="d-flex align-items-center">
                            <div className="settings-icon-container">
                              <FaChartLine className="settings-icon" />
                            </div>
                            <span>Search Usage</span>
                          </div>
                          <span>
                            {searchesUsed}/{searchLimit}
                          </span>
                        </ListGroup.Item>
                      </ListGroup>
                    </div>

                    <div className="mt-4 d-grid gap-2">
                      <Button
                        variant="outline-primary"
                        className="btn-icon text-start"
                        onClick={() => setShowActivityModal(true)}
                        aria-label="View activity history"
                      >
                        <FaHistory className="me-2" /> View Activity History
                      </Button>
                      <Button
                        variant="outline-danger"
                        className="btn-icon text-start"
                        onClick={() => setShowDeleteModal(true)}
                        aria-label="Delete account"
                      >
                        <FaTrash className="me-2" /> Delete Account
                      </Button>
                    </div>
                  </Card.Body>
                </Card>

                {/* Combined Notifications and Security Card */}
                <Card className="user-account-card dashboard-card mt-4">
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="mb-0">
                        <FaBell className="settings-icon me-2" />
                        Notifications
                      </h5>
                      <Badge bg="primary" pill>
                        {notifications?.length || 0}
                      </Badge>
                    </div>

                    {notifications && notifications.length > 0 ? (
                      <div className="notification-list">
                        {notifications
                          .slice(0, 2)
                          .map((notification, index) => (
                            <div
                              key={index}
                              className="notification-item d-flex align-items-start mb-3 pb-3 border-bottom"
                            >
                              <div
                                className={`notification-icon bg-${notification.type || 'light'} bg-opacity-10 me-3`}
                              >
                                <FaInfoCircle
                                  className={`text-${notification.type || 'primary'}`}
                                />
                              </div>
                              <div>
                                <h6 className="mb-1 fs-6">
                                  {notification.title || 'System Notification'}
                                </h6>
                                <p className="mb-1 small text-muted">
                                  {notification.message ||
                                    'You have a new notification'}
                                </p>
                                <small className="text-muted">
                                  {notification.timestamp
                                    ? formatDate(notification.timestamp)
                                    : 'Recently'}
                                </small>
                              </div>
                            </div>
                          ))}
                        {notifications.length > 2 && (
                          <Button
                            variant="link"
                            className="p-0 text-primary"
                            onClick={() => setActiveTab('notifications')}
                            aria-label="View all notifications"
                          >
                            View all notifications
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">
                        You don't have any notifications
                      </p>
                    )}
                  </Card.Body>
                </Card>

                {/* Search Credits Card */}
                <Card className="user-account-card dashboard-card mt-4">
                  <Card.Body className="p-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="mb-0">
                        <FaSearch className="settings-icon me-2" />
                        Search Credits
                      </h5>
                      <Badge
                        bg={
                          calculateRemainingSearches() < 3
                            ? 'danger'
                            : 'success'
                        }
                        pill
                      >
                        {calculateRemainingSearches()} left
                      </Badge>
                    </div>

                    <div>
                      <div className="d-flex justify-content-between mb-2">
                        <span>Searches Used</span>
                        <span>
                          {searchesUsed} of {searchLimit}
                        </span>
                      </div>
                      <ProgressBar
                        now={getSearchUsagePercentage()}
                        variant={
                          getSearchUsagePercentage() >= 90
                            ? 'danger'
                            : getSearchUsagePercentage() >= 70
                              ? 'warning'
                              : 'success'
                        }
                        className="mb-3"
                      />
                      <div className="d-grid">
                        <Button
                          variant="primary"
                          className="btn-icon"
                          onClick={handlePurchaseMore}
                        >
                          <FaShoppingCart className="me-1" /> Buy More Searches
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={8}>
                <Card className="user-account-card dashboard-card">
                  <Card.Header className="bg-transparent p-0">
                    <div className="d-flex align-items-center">
                      <Tabs
                        activeKey={activeTab}
                        onSelect={(k) => setActiveTab(k)}
                        className="nav-tabs flex-grow-1"
                        role="tablist"
                      >
                        <Tab
                          eventKey="profile"
                          title={
                            <>
                              <FaUser className="me-2" />
                              Profile
                            </>
                          }
                          role="tab"
                          aria-label="Profile settings"
                        />
                        <Tab
                          eventKey="security"
                          title={
                            <>
                              <FaShieldAlt className="me-2" />
                              Security
                            </>
                          }
                          role="tab"
                          aria-label="Security settings"
                        />
                        <Tab
                          eventKey="notifications"
                          title={
                            <div className="notification-badge">
                              <FaBell className="me-2" />
                              Notifications
                              {notifications?.length > 0 && (
                                <Badge bg="danger" pill>
                                  {notifications.length}
                                </Badge>
                              )}
                            </div>
                          }
                          role="tab"
                          aria-label="Notification settings"
                        />
                        <Tab
                          eventKey="payments"
                          title={
                            <>
                              <FaCreditCard className="me-2" />
                              Payments
                            </>
                          }
                          role="tab"
                          aria-label="Payment history"
                        />
                      </Tabs>

                      {/* Buy Search Credits Button */}
                      <Button
                        variant="primary"
                        className="buy-credits-btn ms-auto"
                        onClick={handlePurchaseMore}
                      >
                        <FaTags />
                        <span className="d-none d-sm-inline">Buy Searches</span>
                        <span className="search-count">
                          {calculateRemainingSearches()}
                        </span>
                      </Button>
                    </div>
                  </Card.Header>

                  <Card.Body>
                    {activeTab === 'profile' && (
                      <div className="tab-content">
                        <h5 className="mb-4">Personal Information</h5>
                        <Form onSubmit={handleSubmit}>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-4">
                                <Form.Label className="form-label">
                                  <FaUser className="me-2" />
                                  Display Name
                                </Form.Label>
                                <Form.Control
                                  type="text"
                                  value={displayName}
                                  onChange={(e) =>
                                    setDisplayName(e.target.value)
                                  }
                                  placeholder="Enter your name"
                                  required
                                  className="form-control"
                                  aria-required="true"
                                />
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group className="mb-4">
                                <Form.Label className="form-label">
                                  <FaPhone className="me-2" />
                                  Phone Number
                                </Form.Label>
                                <InputGroup>
                                  <InputGroup.Text id="basic-addon1">
                                    +
                                  </InputGroup.Text>
                                  <Form.Control
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Enter phone number"
                                    className="form-control"
                                    aria-describedby="basic-addon1"
                                  />
                                </InputGroup>
                              </Form.Group>
                            </Col>
                          </Row>

                          <Form.Group className="mb-4">
                            <Form.Label className="form-label">
                              <FaInfoCircle className="me-2" />
                              Email Address
                            </Form.Label>
                            <Form.Control
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="your@email.com"
                              required
                              className="form-control"
                              aria-required="true"
                            />
                          </Form.Group>

                          <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                            <Button
                              variant="primary"
                              type="submit"
                              disabled={loading}
                              className="btn-icon px-4 py-2"
                              aria-label="Save profile changes"
                            >
                              {loading ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                  ></span>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <FaSave className="me-2" /> Save Changes
                                </>
                              )}
                            </Button>
                          </div>
                        </Form>
                      </div>
                    )}

                    {/* Updated Payments tab with subtabs */}
                    {activeTab === 'payments' && (
                      <div className="tab-content">
                        <h5 className="mb-4">
                          Payment History & Search Credits
                        </h5>

                        <Card className="bg-light border-0 mb-4">
                          <Card.Body>
                            <div className="d-flex align-items-center justify-content-between mb-3">
                              <div className="d-flex align-items-center">
                                <div className="settings-icon-container me-3">
                                  <FaSearch className="settings-icon" />
                                </div>
                                <div>
                                  <h6 className="mb-1">Available Searches</h6>
                                  <p className="mb-0 fw-bold">
                                    {calculateRemainingSearches()} remaining
                                  </p>
                                </div>
                              </div>
                            </div>

                            <ProgressBar
                              now={getSearchUsagePercentage()}
                              variant={
                                getSearchUsagePercentage() >= 90
                                  ? 'danger'
                                  : getSearchUsagePercentage() >= 70
                                    ? 'warning'
                                    : 'success'
                              }
                              className="mb-2"
                            />
                            <small className="text-muted">
                              {searchesUsed} of {searchLimit} searches used
                            </small>
                          </Card.Body>
                        </Card>

                        {/* Subtabs for Payment History and Buy Credits */}
                        <Nav
                          variant="pills"
                          className="mb-4"
                          activeKey={paymentActiveTab}
                          onSelect={setPaymentActiveTab}
                        >
                          <Nav.Item>
                            <Nav.Link eventKey="history">
                              <FaFileInvoiceDollar className="me-2" /> Payment
                              History
                            </Nav.Link>
                          </Nav.Item>
                          <Nav.Item>
                            <Nav.Link eventKey="pricing">
                              <FaCreditCard className="me-2" /> Buy Search
                              Credits
                            </Nav.Link>
                          </Nav.Item>
                        </Nav>

                        {/* Payment History Tab Content */}
                        {paymentActiveTab === 'history' && (
                          <>
                            {paymentHistory && paymentHistory.length > 0 ? (
                              <>
                                <div className="table-responsive">
                                  <Table
                                    hover
                                    className="payment-history-table"
                                  >
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Plan</th>
                                        <th>Amount</th>
                                        <th>Searches</th>
                                        <th>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {paymentHistory.map((payment, index) => (
                                        <tr key={index}>
                                          <td>{formatDate(payment.date)}</td>
                                          <td>{payment.productName}</td>
                                          <td>${payment.amount.toFixed(2)}</td>
                                          <td>+{payment.searchesAdded}</td>
                                          <td>
                                            <Button
                                              variant="link"
                                              size="sm"
                                              className="p-0 text-primary"
                                              onClick={() =>
                                                handleViewPayment(payment)
                                              }
                                            >
                                              View Details
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>

                                <div className="text-center mt-4">
                                  <Button
                                    variant="outline-primary"
                                    onClick={() =>
                                      setPaymentActiveTab('pricing')
                                    }
                                    className="btn-icon px-4"
                                  >
                                    <FaSearch className="me-2" /> Buy More
                                    Searches
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <Card className="border-0 bg-light">
                                <Card.Body className="text-center py-4">
                                  <FaFileInvoiceDollar
                                    className="text-muted mb-3"
                                    size={30}
                                  />
                                  <h5>No Purchase History</h5>
                                  <p className="text-muted mb-3">
                                    You haven't made any purchases yet
                                  </p>
                                  <Button
                                    variant="primary"
                                    onClick={() =>
                                      setPaymentActiveTab('pricing')
                                    }
                                    className="btn-icon"
                                  >
                                    <FaSearch className="me-2" /> Buy VIN
                                    Searches
                                  </Button>
                                </Card.Body>
                              </Card>
                            )}
                          </>
                        )}

                        {/* Pricing Tab Content */}
                        {paymentActiveTab === 'pricing' && (
                          <div className="pricing-wrapper">
                            <h6 className="mb-3">
                              Select a plan to purchase search credits:
                            </h6>
                            <Pricing isEmbedded={true} />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'security' && (
                      <div className="tab-content">
                        <h5 className="mb-4">Security Settings</h5>

                        <Card className="border-0 shadow-sm mb-4">
                          <Card.Body className="p-4">
                            <h6 className="d-flex align-items-center mb-4">
                              <FaKey className="settings-icon me-2" />
                              Change Password
                            </h6>

                            <Form onSubmit={handleSubmit}>
                              <Form.Group className="mb-3">
                                <Form.Label className="form-label">
                                  <FaLock className="me-2" />
                                  Current Password
                                </Form.Label>
                                <Form.Control
                                  type="password"
                                  value={currentPassword}
                                  onChange={(e) =>
                                    setCurrentPassword(e.target.value)
                                  }
                                  placeholder="Enter your current password"
                                  className="form-control"
                                  aria-required="true"
                                />
                                <Form.Text className="text-muted">
                                  Required to change your password
                                </Form.Text>
                              </Form.Group>

                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label className="form-label">
                                      <FaLock className="me-2" />
                                      New Password
                                    </Form.Label>
                                    <OverlayTrigger
                                      placement="right"
                                      delay={{ show: 250, hide: 400 }}
                                      overlay={(props) =>
                                        renderTooltip(
                                          props,
                                          'Password must be at least 8 characters'
                                        )
                                      }
                                    >
                                      <Form.Control
                                        type="password"
                                        value={password}
                                        onChange={(e) =>
                                          setPassword(e.target.value)
                                        }
                                        placeholder="New password"
                                        autoComplete="new-password"
                                        className="form-control"
                                        aria-describedby="passwordHelp"
                                      />
                                    </OverlayTrigger>

                                    {password && (
                                      <div className="mt-2">
                                        <small className="d-flex justify-content-between mb-1">
                                          <span>Password Strength</span>
                                          <span>
                                            {passwordStrength < 50
                                              ? 'Weak'
                                              : passwordStrength < 75
                                                ? 'Medium'
                                                : 'Strong'}
                                          </span>
                                        </small>
                                        <ProgressBar
                                          now={passwordStrength}
                                          variant={getPasswordStrengthColor()}
                                          className="password-strength-meter"
                                        />
                                      </div>
                                    )}
                                  </Form.Group>
                                </Col>

                                <Col md={6}>
                                  <Form.Group className="mb-4">
                                    <Form.Label className="form-label">
                                      <FaLock className="me-2" />
                                      Confirm New Password
                                    </Form.Label>
                                    <Form.Control
                                      type="password"
                                      value={confirmPassword}
                                      onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                      }
                                      placeholder="Confirm new password"
                                      autoComplete="new-password"
                                      className="form-control"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>
                            </Form>
                          </Card.Body>
                        </Card>

                        {/* Security tab content - same as original */}
                        {/* Payment Management Button */}
                        <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                          <Button
                            variant="outline-primary"
                            onClick={handleManagePaymentMethods}
                            className="me-2"
                          >
                            <FaCreditCard className="me-2" /> Manage Payment
                            Methods
                          </Button>
                          <Button
                            variant="primary"
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="btn-icon px-4 py-2"
                            aria-label="Save security settings"
                          >
                            <FaSave className="me-2" /> Save Security Settings
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeTab === 'notifications' && (
                      <div className="tab-content">
                        <h5 className="mb-4">Notification Settings</h5>

                        <Form>
                          <Card className="border-0 shadow-sm mb-4">
                            <Card.Body className="p-4">
                              <h6 className="d-flex align-items-center mb-4">
                                <FaEnvelope className="settings-icon me-2" />
                                Email Notifications
                              </h6>

                              <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                <div>
                                  <p className="mb-0">Search Limit Alerts</p>
                                  <small className="text-muted">
                                    Notify when nearing search limit
                                  </small>
                                </div>
                                <Form.Check
                                  type="switch"
                                  id="search-limit-switch"
                                  defaultChecked
                                  aria-label="Toggle search limit alerts"
                                />
                              </div>

                              <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                <div>
                                  <p className="mb-0">Newsletter</p>
                                  <small className="text-muted">
                                    Receive our monthly newsletter
                                  </small>
                                </div>
                                <Form.Check
                                  type="switch"
                                  id="newsletter-switch"
                                  defaultChecked
                                  aria-label="Toggle newsletter subscription"
                                />
                              </div>

                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <div>
                                  <p className="mb-0">Promotional Emails</p>
                                  <small className="text-muted">
                                    Receive special offers and promotions
                                  </small>
                                </div>
                                <Form.Check
                                  type="switch"
                                  id="promo-switch"
                                  aria-label="Toggle promotional emails"
                                />
                              </div>
                            </Card.Body>
                          </Card>

                          <Card className="border-0 shadow-sm mb-4">
                            <Card.Body className="p-4">
                              <h6 className="d-flex align-items-center mb-4">
                                <FaBell className="settings-icon me-2" />
                                Recent Notifications
                              </h6>

                              {notifications && notifications.length > 0 ? (
                                <ListGroup variant="flush">
                                  {notifications.map((notification, index) => (
                                    <ListGroup.Item
                                      key={index}
                                      className="notification-item px-0 py-3 border-bottom"
                                    >
                                      <div className="d-flex">
                                        <div
                                          className={`notification-icon bg-${notification.type || 'light'} bg-opacity-10 me-3`}
                                        >
                                          <FaBell
                                            className={`text-${notification.type || 'primary'}`}
                                          />
                                        </div>
                                        <div>
                                          <h6 className="mb-1">
                                            {notification.title ||
                                              'System Notification'}
                                          </h6>
                                          <p className="mb-1 small">
                                            {notification.message ||
                                              'You have a new notification'}
                                          </p>
                                          <small className="text-muted">
                                            {notification.timestamp
                                              ? formatDate(
                                                  notification.timestamp
                                                )
                                              : 'Recently'}
                                          </small>
                                        </div>
                                        <Button
                                          variant="link"
                                          className="ms-auto text-muted p-0"
                                          title="Mark as read"
                                          aria-label="Mark notification as read"
                                        >
                                          <FaCheck />
                                        </Button>
                                      </div>
                                    </ListGroup.Item>
                                  ))}
                                </ListGroup>
                              ) : (
                                <Card className="border-0 bg-light">
                                  <Card.Body className="text-center py-4">
                                    <FaBell
                                      className="text-muted mb-3"
                                      size={30}
                                    />
                                    <h6>No New Notifications</h6>
                                    <p className="text-muted mb-0">
                                      You're all caught up!
                                    </p>
                                  </Card.Body>
                                </Card>
                              )}

                              {notifications && notifications.length > 0 && (
                                <div className="d-flex justify-content-center mt-3">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="btn-icon"
                                    aria-label="Mark all notifications as read"
                                  >
                                    Mark all as read
                                  </Button>
                                </div>
                              )}
                            </Card.Body>
                          </Card>

                          <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                            <Button
                              variant="primary"
                              type="submit"
                              className="btn-icon px-4 py-2"
                              aria-label="Save notification preferences"
                            >
                              <FaSave className="me-2" /> Save Notification
                              Preferences
                            </Button>
                          </div>
                        </Form>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Container>

          {/* Photo Upload Modal */}
          <Modal
            show={showPhotoModal}
            onHide={() => setShowPhotoModal(false)}
            centered
            className="user-account-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>Update Profile Photo</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {photoPreview && (
                <div className="image-preview-container text-center mb-3">
                  <Image
                    src={photoPreview}
                    alt="Preview"
                    thumbnail
                    loading="lazy"
                  />
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowPhotoModal(false)}
                className="btn-icon"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={uploadProfilePhoto}
                disabled={loading}
                className="btn-icon"
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Uploading...
                  </>
                ) : (
                  'Save Photo'
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Delete Account Modal */}
          <Modal
            show={showDeleteModal}
            onHide={() => setShowDeleteModal(false)}
            centered
            className="user-account-modal"
          >
            <Modal.Header closeButton className="bg-danger text-white">
              <Modal.Title>Delete Account</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="text-center mb-4">
                <div className="bg-danger bg-opacity-10 p-3 rounded-circle d-inline-flex mb-3">
                  <FaTrash size={30} className="text-danger" />
                </div>
                <h5>Are you sure you want to delete your account?</h5>
                <p className="text-muted">
                  This action cannot be undone. All your data will be
                  permanently removed.
                </p>
              </div>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Type "DELETE" to confirm</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="DELETE"
                    className="form-control"
                    aria-label="Confirm account deletion"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Enter your password"
                    className="form-control"
                    aria-label="Enter password to confirm deletion"
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="outline-secondary"
                onClick={() => setShowDeleteModal(false)}
                className="btn-icon"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="btn-icon"
                aria-label="Confirm account deletion"
              >
                Delete Account
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Activity History Modal */}
          <Modal
            show={showActivityModal}
            onHide={() => setShowActivityModal(false)}
            size="lg"
            centered
            className="user-account-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>Activity History</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {activityHistory && activityHistory.length > 0 ? (
                <div className="p-2">
                  {activityHistory.map((activity, index) => (
                    <div key={index} className="timeline-item py-2 mb-3">
                      <div className="timeline-circle"></div>
                      <h6 className="mb-1">
                        {activity.action === 'profile_update' &&
                          'Profile Updated'}
                        {activity.action === 'photo_update' && 'Photo Updated'}
                        {activity.action === 'login' && 'Account Login'}
                        {activity.action === 'payment' && 'Purchase Made'}
                        {activity.action === 'search' && 'VIN Search'}
                        {!activity.action && 'Account Activity'}
                      </h6>
                      <p className="mb-0 small">
                        {activity.details || 'No details available'}
                      </p>
                      <small className="text-muted">
                        {formatDate(activity.timestamp)}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5">
                  <FaHistory className="text-muted mb-3" size={40} />
                  <h5>No Activity Yet</h5>
                  <p className="text-muted">
                    Your activity history will appear here
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowActivityModal(false)}
                className="btn-icon"
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Payment Details Modal */}
          <Modal
            show={showPaymentModal}
            onHide={() => setShowPaymentModal(false)}
            centered
            className="user-account-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>
                <FaFileInvoiceDollar className="me-2" />
                Payment Details
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedPayment ? (
                <div>
                  <div className="text-center mb-4">
                    <Badge bg="success" className="px-3 py-2">
                      <FaCheckCircle className="me-2" />
                      Payment Successful
                    </Badge>
                  </div>

                  <ListGroup variant="flush">
                    <ListGroup.Item className="d-flex justify-content-between py-3">
                      <strong>Transaction Date:</strong>
                      <span>{formatDate(selectedPayment.date)}</span>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between py-3">
                      <strong>Plan:</strong>
                      <span>{selectedPayment.productName}</span>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between py-3">
                      <strong>Amount:</strong>
                      <span>${selectedPayment.amount.toFixed(2)}</span>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between py-3">
                      <strong>Searches Added:</strong>
                      <span>{selectedPayment.searchesAdded}</span>
                    </ListGroup.Item>

                    <ListGroup.Item className="d-flex justify-content-between py-3">
                      <strong>Transaction ID:</strong>
                      <span className="text-muted">
                        {selectedPayment.paymentId?.substring(0, 12)}...
                      </span>
                    </ListGroup.Item>
                  </ListGroup>

                  <div className="text-center mt-4">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-2"
                      onClick={handleManagePaymentMethods}
                    >
                      <FaCreditCard className="me-2" />
                      Manage Payment Methods
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setActiveTab('payments');
                        setPaymentActiveTab('pricing');
                      }}
                    >
                      <FaSearch className="me-2" />
                      Buy More Searches
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Loading payment details...</p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Close
              </Button>
              {selectedPayment && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setActiveTab('payments');
                    setPaymentActiveTab('pricing');
                  }}
                >
                  <FaSearch className="me-2" /> Buy More Searches
                </Button>
              )}
            </Modal.Footer>
          </Modal>

          {/* Buy Search Credits Modal */}
          <Modal
            show={showBuySearchModal}
            onHide={() => setShowBuySearchModal(false)}
            size="lg"
            centered
            className="user-account-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>
                <FaTags className="me-2" />
                Buy Search Credits
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-4">
                <Card className="bg-light border-0 mb-4">
                  <Card.Body>
                    <div className="d-flex align-items-center mb-3">
                      <div className="settings-icon-container me-3">
                        <FaSearch className="settings-icon" />
                      </div>
                      <div>
                        <h6 className="mb-1">Your Current Credits</h6>
                        <div className="d-flex align-items-center">
                          <div className="me-3">
                            <span className="fw-bold text-success">
                              {calculateRemainingSearches()}
                            </span>{' '}
                            remaining
                          </div>
                          <div>
                            <small className="text-muted">
                              {searchesUsed} of {searchLimit} used
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>

                    <ProgressBar
                      now={getSearchUsagePercentage()}
                      variant={
                        getSearchUsagePercentage() >= 90
                          ? 'danger'
                          : getSearchUsagePercentage() >= 70
                            ? 'warning'
                            : 'success'
                      }
                      className="mb-2"
                    />
                  </Card.Body>
                </Card>

                <h5 className="mb-3">Choose a package</h5>
                <div className="row g-3">
                  {/* Quick buy options */}
                  <div className="col-md-4">
                    <Card
                      className="h-100 pricing-card shadow border"
                      onClick={goToPricingTab}
                      style={{ cursor: 'pointer' }}
                    >
                      <Card.Body className="text-center">
                        <div className="search-count-icon mb-3">
                          <FaSearch size={24} className="text-primary" />
                          <span className="search-count-number">1</span>
                        </div>
                        <h5>Single Search</h5>
                        <p className="price mb-0">$11.95</p>
                        <p className="text-muted small">
                          Basic vehicle details
                        </p>
                      </Card.Body>
                    </Card>
                  </div>

                  <div className="col-md-4">
                    <Card
                      className="h-100 pricing-card shadow border border-primary popular-plan"
                      onClick={goToPricingTab}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="popular-badge">
                        <Badge bg="primary" pill>
                          Best Value
                        </Badge>
                      </div>
                      <Card.Body className="text-center">
                        <div className="search-count-icon mb-3">
                          <FaSearch size={24} className="text-primary" />
                          <span className="search-count-number">5</span>
                        </div>
                        <h5>Explorer Pack</h5>
                        <p className="price mb-0">$40.95</p>
                        <p className="text-muted small">
                          Complete vehicle history
                        </p>
                      </Card.Body>
                    </Card>
                  </div>

                  <div className="col-md-4">
                    <Card
                      className="h-100 pricing-card shadow border"
                      onClick={goToPricingTab}
                      style={{ cursor: 'pointer' }}
                    >
                      <Card.Body className="text-center">
                        <div className="search-count-icon mb-3">
                          <FaSearch size={24} className="text-primary" />
                          <span className="search-count-number">8</span>
                        </div>
                        <h5>Pro Pack</h5>
                        <p className="price mb-0">$59.95</p>
                        <p className="text-muted small">
                          Full history + support
                        </p>
                      </Card.Body>
                    </Card>
                  </div>
                </div>
              </div>

              <div className="text-center mt-4">
                <p>Need more options? View our complete pricing plans:</p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={goToPricingTab}
                  className="px-4"
                >
                  <FaTags className="me-2" />
                  See All Pricing Plans
                </Button>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => setShowBuySearchModal(false)}
              >
                Close
              </Button>
            </Modal.Footer>
          </Modal>
        </main>
      </div>
    </>
  );
};

export default UserAccount;

