import { loadStripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';

// Initialize Firebase Functions
const functions = getFunctions();

// Initialize Stripe with your publishable key from environment variables
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

/**
 * Creates a checkout session for a one-time payment
 * @param {Object} options - Checkout options
 * @param {string} options.price - The Stripe Price ID
 * @param {string} options.successUrl - URL to redirect after successful payment
 * @param {string} options.cancelUrl - URL to redirect after cancelled payment
 * @param {string} options.searchCredits - Number of search credits to add
 * @param {string} options.productName - Name of the product being purchased
 * @param {string} options.membershipType - Type of membership (free, premium, business)
 * @param {string} options.durationDays - Duration of membership in days
 * @returns {Promise<Object>} - Contains sessionId and URL
 */
export const createCheckoutSession = async (options) => {
  try {
    // Make sure all required parameters are present
    if (!options.price) {
      throw new Error('Price ID is required');
    }

    // Default success and cancel URLs if not provided
    const successUrl =
      options.successUrl ||
      `${window.location.origin}/user-account?payment_success=true&plan=${options.productName || ''}`;
    const cancelUrl =
      options.cancelUrl ||
      `${window.location.origin}/pricing?payment_canceled=true`;

    // Create a checkout session using the Firebase Cloud Function
    const createSession = httpsCallable(functions, 'createCheckoutSession');

    console.log('Creating checkout session with options:', {
      ...options,
      successUrl,
      cancelUrl,
    });

    const result = await createSession({
      price: options.price,
      successUrl,
      cancelUrl,
      searchCredits: options.searchCredits || '0',
      productName: options.productName || 'VIN Search Credits',
      membershipType: options.membershipType || 'free',
      durationDays: options.durationDays || '365',
      metadata: options.metadata || {},
    });

    console.log('Checkout session created:', result);
    return result.data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Redirects to Stripe Checkout with the given options
 * @param {Object} options - Options for the checkout
 * @returns {Promise<void>}
 */
export const redirectToCheckout = async (options) => {
  try {
    const result = await createCheckoutSession(options);

    // If session URL is returned directly, use that
    if (result.url) {
      window.location.href = result.url;
      return;
    }

    // Otherwise, use sessionId with redirectToCheckout
    if (result.sessionId) {
      const stripe = await getStripe();
      await stripe.redirectToCheckout({ sessionId: result.sessionId });
      return;
    }

    throw new Error('Invalid checkout session response');
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * Redirects to Stripe Customer Portal
 * @param {string} returnUrl - URL to return to after closing the portal (optional)
 * @returns {Promise<void>}
 */
export const redirectToCustomerPortal = async (returnUrl) => {
  try {
    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const createPortalSession = httpsCallable(functions, 'createPortalSession');
    const result = await createPortalSession({
      returnUrl: returnUrl || `${window.location.origin}/user-account`,
    });

    // Navigate to the portal URL
    if (result.data && result.data.url) {
      window.location.href = result.data.url;
    } else {
      throw new Error('Invalid portal session response');
    }
  } catch (error) {
    console.error('Error redirecting to customer portal:', error);
    throw error;
  }
};

/**
 * Get user's payment details including search limit and history
 * @returns {Promise<Object>} Payment details
 */
export const getPaymentDetails = async () => {
  try {
    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const fetchPaymentDetails = httpsCallable(functions, 'getPaymentDetails');
    return await fetchPaymentDetails();
  } catch (error) {
    console.error('Error getting payment details:', error);
    throw error;
  }
};

/**
 * Check user's search credits
 * @returns {Promise<Object>} Search credit details
 */
export const checkSearchCredits = async () => {
  try {
    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const checkCredits = httpsCallable(functions, 'checkSearchCredits');
    return await checkCredits();
  } catch (error) {
    console.error('Error checking search credits:', error);
    throw error;
  }
};

/**
 * Increment user's search count
 * @returns {Promise<Object>} Updated search count info
 */
export const incrementSearchCount = async () => {
  try {
    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const increment = httpsCallable(functions, 'incrementSearchCount');
    return await increment();
  } catch (error) {
    console.error('Error incrementing search count:', error);
    throw error;
  }
};

/**
 * Reset user's search count (for testing/development only)
 * @returns {Promise<Object>} Result of reset operation
 */
export const resetSearchCount = async () => {
  try {
    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const reset = httpsCallable(functions, 'resetSearchCount');
    return await reset();
  } catch (error) {
    console.error('Error resetting search count:', error);
    throw error;
  }
};

// Export the getStripe function as default
export default getStripe;
