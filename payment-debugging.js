/**
 * Payment Debugging Utilities
 *
 * This file provides utility functions to help debug payment-related issues
 * Do not use these functions in production, they're for development only
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, getPaymentDetails } from './firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

const functions = getFunctions();

/**
 * Get the complete user payment status
 * @returns {Promise<Object>} All payment-related data
 */
export const debugPaymentStatus = async () => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in');
  }

  try {
    const uid = auth.currentUser.uid;
    const results = {};

    // Get user document
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      results.userData = {
        searchLimit: userData.searchLimit || 0,
        searchesUsed: userData.searchesUsed || 0,
        membershipLevel: userData.membership || 'free',
        lastPaymentDate: userData.lastPaymentDate
          ? userData.lastPaymentDate.toDate()
          : null,
        stripeCustomerId: userData.stripeCustomerId || null,
      };
    } else {
      results.userData = 'User document not found';
    }

    // Get transactions
    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', uid)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    results.transactions = [];

    if (!transactionsSnapshot.empty) {
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        results.transactions.push({
          id: doc.id,
          date: data.timestamp ? data.timestamp.toDate() : null,
          productName: data.productName || 'Unknown Product',
          amount: data.amount || 0,
          searchesAdded: data.searchesAdded || 0,
          stripePaymentId: data.stripePaymentId || null,
          checkoutSessionId: data.checkoutSessionId || null,
        });
      });
    }

    // Get from functions
    try {
      const paymentDetailsResult = await getPaymentDetails();
      results.paymentDetails =
        paymentDetailsResult && paymentDetailsResult.data;
    } catch (error) {
      results.paymentDetailsError = error.message;
    }

    // Check search credits
    try {
      const checkCreditsFunc = httpsCallable(functions, 'checkSearchCredits');
      const creditsResult = await checkCreditsFunc();
      results.searchCredits = creditsResult.data;
    } catch (error) {
      results.searchCreditsError = error.message;
    }

    return results;
  } catch (error) {
    console.error('Error debugging payment status:', error);
    return { error: error.message };
  }
};

/**
 * Manually add search credits to the user for testing
 * @param {number} credits - Number of credits to add
 * @returns {Promise<Object>} Result of the operation
 */
export const manuallyAddSearchCredits = async (credits = 1) => {
  try {
    if (!auth.currentUser || process.env.NODE_ENV === 'production') {
      throw new Error(
        'Only available in development mode for authenticated users'
      );
    }

    const addCreditsFunc = httpsCallable(functions, 'debugAddSearchCredits');
    const result = await addCreditsFunc({ creditsToAdd: credits });
    return result.data;
  } catch (error) {
    console.error('Error adding manual search credits:', error);
    return { error: error.message };
  }
};

/**
 * Show the user's current webhook configuration status
 * Not functional on client side - just shows guidance
 */
export const checkWebhookConfiguration = () => {
  return {
    guidance: [
      '1. Go to your Stripe Dashboard -> Developers -> Webhooks',
      '2. Ensure your webhook endpoint is: https://<region>-<project-id>.cloudfunctions.net/stripeWebhookHandler',
      "3. Check that it's listening for 'checkout.session.completed' events",
      '4. Verify the signing secret matches the one in your Firebase configuration',
      '5. In Stripe logs, look for failed webhook deliveries',
    ],
    testWebhook:
      'To test a webhook, use Stripe CLI: stripe listen --forward-to <your-webhook-url>',
    configure:
      'Configure in Firebase with: firebase functions:config:set stripe.webhook_secret=YOUR_WEBHOOK_SECRET',
  };
};

// Debug payment flow by simulating a purchase - for development only
export const debugPaymentFlow = async (
  productId = 'test_product',
  amount = 5
) => {
  if (process.env.NODE_ENV === 'production') {
    console.error('This function is not available in production');
    return { error: 'Debug functions are disabled in production' };
  }

  if (!auth.currentUser) {
    return { error: 'User must be logged in' };
  }

  return {
    message:
      'This is a development-only function that would simulate payment processing',
    environment: process.env.NODE_ENV,
    userId: auth.currentUser.uid,
    userEmail: auth.currentUser.email,
    productId,
    amount,
    searchCreditsToAdd: amount,
    testSteps: [
      '1. Check Stripe Dashboard for webhook events',
      '2. Verify Firebase Function logs for webhook processing',
      "3. Check Firestore 'transactions' collection",
      '4. Verify user document was updated with new search limit',
    ],
  };
};

export default {
  debugPaymentStatus,
  manuallyAddSearchCredits,
  checkWebhookConfiguration,
  debugPaymentFlow,
};
