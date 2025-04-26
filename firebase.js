import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(
  app,
  process.env.REACT_APP_FIREBASE_REGION || 'us-central1'
);

// Get Firebase region and project ID for API calls
const region = process.env.REACT_APP_FIREBASE_REGION || 'us-central1';
const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;

// Create authentication providers
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Initialize user when they authenticate
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    // Check if the user document already exists
    if (!docSnap.exists()) {
      try {
        // Create a new user document with the updated structure including AI chat access
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          phone: user.phoneNumber || '',
          membership: 'free', // Default membership
          searchLimit: 5, // Free users get 5 searches
          searchesUsed: 0, // No searches used yet
          expirationDate: null, // No expiration date
          paymentId: null, // No payment ID
          lastSearchTime: null, // Track when user last performed a search (for AI chat access)
          chatHistory: [], // Store chat history with AI
          createdAt: serverTimestamp(), // Account creation date
          lastLogin: serverTimestamp(), // Last login timestamp
        });
        console.log('New user document created for:', user.uid);
      } catch (error) {
        console.error('Error creating user document:', error);
      }
    } else {
      // Update last login timestamp
      try {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
        });
        console.log('User login timestamp updated for:', user.uid);
      } catch (error) {
        console.error('Error updating user login timestamp:', error);
      }
    }
  }
});

/**
 * Helper function to make authenticated HTTP API calls to Firebase Functions
 * @param {string} endpoint The API endpoint to call (without region/project)
 * @param {string} method HTTP method to use (GET, POST, etc.)
 * @param {Object} [body] Request body (for POST/PUT)
 * @returns {Promise<any>} API response data
 */
const callFunctionApi = async (endpoint, method = 'GET', body = null) => {
  if (!auth.currentUser) {
    throw new Error('User must be logged in');
  }

  const idToken = await auth.currentUser.getIdToken();

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    Origin: window.location.origin,
  };

  const options = {
    method,
    headers,
    credentials: 'same-origin',
    mode: 'cors',
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `https://${region}-${projectId}.cloudfunctions.net/${endpoint}`,
    options
  );

  if (!response.ok) {
    throw new Error(
      `API call failed: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
};

/**
 * Checks if the API is accessible with a test call to the status endpoint
 * @returns {Promise<boolean>} True if the API is accessible
 */
export const checkApiStatus = async () => {
  try {
    const response = await fetch(
      `https://${region}-${projectId}.cloudfunctions.net/status`
    );

    if (!response.ok) {
      console.warn(
        'API status check failed:',
        response.status,
        response.statusText
      );
      return false;
    }

    const data = await response.json();
    console.log('API status check successful:', data);
    return true;
  } catch (error) {
    console.error('API status check error:', error);
    return false;
  }
};

/**
 * Creates a checkout session with Stripe
 * @param {Object} data Configuration data for the checkout session
 * @param {string} data.price Stripe price ID
 * @param {string} data.success_url URL to redirect to on successful payment
 * @param {string} data.cancel_url URL to redirect to on canceled payment
 * @param {Object} data.metadata Additional metadata for the checkout session
 * @returns {Promise<{url: string}|{sessionId: string}>} Checkout session data
 */
export const createCheckoutSession = async (data) => {
  try {
    // Log the data being sent to help debug issues
    console.log('Creating checkout session with data:', {
      price: data.price,
      success_url: data.success_url,
      cancel_url: data.cancel_url,
      searchCredits: data.searchCredits || data.metadata?.searchCredits,
      productName: data.productName || data.metadata?.productName,
      membershipType: data.membershipType || data.metadata?.membershipType,
      durationDays: data.durationDays || data.metadata?.durationDays,
      metadata: data.metadata,
    });

    if (!auth.currentUser) {
      throw new Error('User must be logged in to create a checkout session');
    }

    // Prepare the metadata with all necessary fields
    const completeMetadata = {
      searchCredits:
        data.searchCredits?.toString() ||
        data.metadata?.searchCredits?.toString() ||
        '0',
      productName:
        data.productName || data.metadata?.productName || 'VIN Search Credits',
      membershipType:
        data.membershipType || data.metadata?.membershipType || 'free',
      durationDays:
        data.durationDays?.toString() ||
        data.metadata?.durationDays?.toString() ||
        '365',
      ...data.metadata,
    };

    // First try using the HTTP API wrapper
    try {
      const requestBody = {
        price: data.price,
        mode: 'payment',
        success_url: data.success_url,
        cancel_url: data.cancel_url,
        metadata: completeMetadata,
      };

      const result = await callFunctionApi(
        'createCheckoutSessionWrapper',
        'POST',
        requestBody
      );
      console.log('Checkout session created successfully via HTTP:', result);
      return result;
    } catch (error) {
      console.warn(
        'Direct HTTP call failed, falling back to callable function:',
        error
      );

      // Fallback to using the callable function
      const checkoutSessionFunc = httpsCallable(
        functions,
        'createCheckoutSession'
      );

      const result = await checkoutSessionFunc({
        price: data.price,
        successUrl: data.success_url,
        cancelUrl: data.cancel_url,
        searchCredits: data.searchCredits || data.metadata?.searchCredits,
        productName: data.productName || data.metadata?.productName,
        membershipType: data.membershipType || data.metadata?.membershipType,
        durationDays: data.durationDays || data.metadata?.durationDays,
        metadata: data.metadata || {},
      });

      console.log(
        'Checkout session created successfully via callable function:',
        result
      );
      return result.data;
    }
  } catch (error) {
    console.error('Failed to create checkout session:', error);
    throw error;
  }
};

/**
 * Gets payment details for the current user
 * @returns {Promise<Object>} Payment details including search limits and history
 */
export const getPaymentDetails = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to get payment details');
    }

    // First try using the wrapper function which handles CORS
    try {
      const data = await callFunctionApi('getPaymentDetailsApi');
      console.log('Payment details fetched successfully via HTTP:', data);
      return { data };
    } catch (error) {
      console.warn(
        'Direct HTTP call failed, falling back to callable function:',
        error
      );

      // Fallback to using the callable function
      const getPaymentDetailsFunc = httpsCallable(
        functions,
        'getPaymentDetails'
      );

      const result = await getPaymentDetailsFunc();
      console.log(
        'Payment details fetched successfully via callable function:',
        result
      );
      return result;
    }
  } catch (error) {
    console.error('Failed to get payment details:', error);
    throw error;
  }
};

/**
 * Creates a Stripe customer portal session
 * @returns {Promise<{url: string}>} Portal session URL
 */
export const createPortalSession = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to access customer portal');
    }

    const createPortalSessionFunc = httpsCallable(
      functions,
      'createPortalSession'
    );

    const result = await createPortalSessionFunc();
    console.log('Portal session created:', result);
    return result;
  } catch (error) {
    console.error('Failed to create portal session:', error);
    throw error;
  }
};

/**
 * Increments the user's search count and updates last search time
 * @returns {Promise<{searchesUsed: number, searchLimit: number, remainingSearches: number}>} Updated search counts
 */
export const incrementSearchCount = async () => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to increment search count');
    }

    // Call the cloud function first to validate search limits
    const incrementSearchCountFunc = httpsCallable(
      functions,
      'incrementSearchCount'
    );

    const result = await incrementSearchCountFunc();
    console.log('Search count incremented:', result.data);

    // Update local cache
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      searchesUsed: result.data.searchesUsed,
      lastSearchTime: serverTimestamp(), // This enables AI chat access for 24 hours
    });

    return result.data;
  } catch (error) {
    console.error('Failed to increment search count:', error);

    // If error is about exceeding search limit, handle gracefully
    if (error.code === 'functions/resource-exhausted') {
      throw new Error(
        'Search limit exceeded. Please purchase more search credits.'
      );
    }

    throw error;
  }
};

/**
 * Gets the current user's searches used count
 * @returns {Promise<number>} Number of searches used
 */
export const getSearchesUsed = async () => {
  try {
    if (!auth.currentUser) return 0;

    // First try to use the HTTP API directly
    try {
      const searchesUsed = await callFunctionApi('getSearchesUsedApi');
      console.log('Searches used fetched via HTTP:', searchesUsed);
      return searchesUsed || 0;
    } catch (error) {
      console.warn(
        'Failed to get searches used from HTTP API, using callable function:',
        error
      );

      // Fall back to using the callable function
      try {
        const getSearchesUsedFunc = httpsCallable(functions, 'getSearchesUsed');
        const result = await getSearchesUsedFunc();
        console.log(
          'Searches used fetched via callable function:',
          result.data
        );
        return result.data || 0;
      } catch (funcError) {
        console.warn(
          'Failed to get searches used from function, using local data:',
          funcError
        );

        // Fall back to local data
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          return userDoc.data().searchesUsed || 0;
        }
      }
    }

    return 0;
  } catch (error) {
    console.error('Failed to get searches used:', error);
    return 0;
  }
};

/**
 * Gets the user's search limit
 * @returns {Promise<number>} Search limit
 */
export const getSearchLimit = async () => {
  try {
    if (!auth.currentUser) return 0;

    // First try to use the HTTP API directly
    try {
      const searchLimit = await callFunctionApi('getSearchLimitApi');
      console.log('Search limit fetched via HTTP:', searchLimit);
      return searchLimit || 0;
    } catch (error) {
      console.warn(
        'Failed to get search limit from HTTP API, using callable function:',
        error
      );

      // Fall back to using the callable function
      try {
        const getSearchLimitFunc = httpsCallable(functions, 'getSearchLimit');
        const result = await getSearchLimitFunc();
        console.log('Search limit fetched via callable function:', result.data);
        return result.data || 0;
      } catch (funcError) {
        console.warn(
          'Failed to get search limit from function, using local data:',
          funcError
        );

        // Fall back to local data as a last resort
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          return userDoc.data().searchLimit || 0;
        }
      }
    }

    return 0;
  } catch (error) {
    console.error('Failed to get search limit:', error);
    return 0;
  }
};

/**
 * Checks if the user has remaining searches available
 * @returns {Promise<Object>} Search credit details including if user can search
 */
export const checkSearchCredits = async () => {
  try {
    if (!auth.currentUser) {
      return { canSearch: false, remainingSearches: 0 };
    }

    // First try HTTP API
    try {
      const creditInfo = await callFunctionApi('checkSearchCreditsApi');
      console.log('Search credits checked via HTTP API:', creditInfo);
      return creditInfo;
    } catch (error) {
      console.warn(
        'HTTP API failed for search credits, using callable function:',
        error
      );

      // Fall back to callable function
      const checkCreditsFunc = httpsCallable(functions, 'checkSearchCredits');
      const result = await checkCreditsFunc();
      console.log('Search credits checked via callable function:', result.data);
      return result.data;
    }
  } catch (error) {
    console.error('Failed to check search credits:', error);
    return { canSearch: false, remainingSearches: 0, error: error.message };
  }
};

/**
 * Checks if the user has active AI chat access
 * @returns {Promise<boolean>} Whether user has active chat access
 */
export const hasActiveChatAccess = async () => {
  try {
    if (!auth.currentUser) return false;

    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();

    // Check if user is premium/business
    const isPremium =
      userData.membership?.toLowerCase() === 'premium' ||
      userData.membership?.toLowerCase() === 'business';
    if (!isPremium) return false;

    // Check if last search is within 24 hours
    const lastSearchTime = userData.lastSearchTime?.toDate();
    if (!lastSearchTime) return false;

    const now = new Date();
    const hoursSinceLastSearch = (now - lastSearchTime) / (1000 * 60 * 60);

    return hoursSinceLastSearch <= 24;
  } catch (error) {
    console.error('Failed to check chat access status:', error);
    return false;
  }
};

/**
 * Logs a chat interaction with the AI
 * @param {string} userMessage User's message
 * @param {string} aiResponse AI's response
 * @returns {Promise<void>}
 */
export const logAIChat = async (userMessage, aiResponse) => {
  try {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);

    // Get the current chat history
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const currentChatHistory = userData.chatHistory || [];

    // Add the new chat entry
    const newChatHistory = [
      {
        timestamp: serverTimestamp(),
        userMessage,
        aiResponse,
      },
      ...currentChatHistory.slice(0, 49), // Keep only the 50 most recent chats
    ];

    // Update the user's chat history
    await updateDoc(userRef, {
      chatHistory: newChatHistory,
    });
  } catch (error) {
    console.error('Failed to log AI chat:', error);
  }
};

/**
 * Resets user's search count (for development/testing only)
 * @returns {Promise<Object>} Result of the operation
 */
export const resetSearchCount = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('resetSearchCount should not be called in production');
    return { success: false, message: 'Not allowed in production' };
  }

  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in to reset search count');
    }

    const resetFunc = httpsCallable(functions, 'resetSearchCount');
    const result = await resetFunc();
    console.log('Search count reset:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to reset search count:', error);
    throw error;
  }
};

/**
 * Debug function to add search credits directly (for testing only)
 */
export const debugAddSearchCredits = async (credits = 1) => {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be logged in');
    }

    const addCreditsFunc = httpsCallable(functions, 'debugAddSearchCredits');
    const result = await addCreditsFunc({ creditsToAdd: credits });
    console.log('Debug search credits added:', result.data);
    return result.data;
  } catch (error) {
    console.error('Failed to add debug search credits:', error);
    throw error;
  }
};

// Export all necessary functions and objects
export {
  app,
  auth,
  db,
  storage,
  functions,
  googleProvider,
  appleProvider,
  signInWithPopup,
  onAuthStateChanged,
};

