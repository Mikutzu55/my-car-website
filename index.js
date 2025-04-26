// Load environment variables from .env file for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Use Firebase config if available, otherwise fall back to .env variables
const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  (functions.config().stripe
    ? functions.config().stripe.secret_key
    : undefined);
const webhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET ||
  (functions.config().stripe
    ? functions.config().stripe.webhook_secret
    : undefined);
const appUrl =
  process.env.APP_URL ||
  (functions.config().app
    ? functions.config().app.url
    : 'http://localhost:3000');

const stripe = require('stripe')(stripeSecretKey);

// Enhanced CORS handling with multiple origins
const cors = require('cors')({
  origin: [
    'http://localhost:3000',
    'https://mycarwebsite-f69e4.web.app',
    'https://mycarwebsite-f69e4.firebaseapp.com',
  ],
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
});

// Enhanced CORS handler function that properly handles OPTIONS requests
const handleCors = (handler) => {
  return (req, res) => {
    // For OPTIONS requests, respond immediately with CORS headers
    if (req.method === 'OPTIONS') {
      // Set CORS headers for preflight request
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.set('Access-Control-Allow-Credentials', 'true');
      res.status(204).send('');
      return;
    }

    // For regular requests, use the cors middleware
    return cors(req, res, () => handler(req, res));
  };
};

admin.initializeApp();

// Create a Stripe customer when a new user signs up
exports.createStripeCustomer = functions.auth.user().onCreate(async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        firebaseUID: user.uid,
      },
    });

    await admin.firestore().collection('users').doc(user.uid).set(
      {
        stripeCustomerId: customer.id,
        email: user.email,
        membership: 'free',
        searchLimit: 5,
        searchesUsed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return null;
  } catch (error) {
    console.error('Error creating customer:', error);
    return null;
  }
});

// Wrapper for the Firebase Extension's createCheckoutSession function
// This adds CORS support to fix the cross-origin issues
exports.createCheckoutSessionWrapper = functions.https.onRequest(
  handleCors(async (req, res) => {
    try {
      // Verify authentication from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;

      if (!uid) {
        return res.status(401).json({ error: 'User must be logged in' });
      }

      // Get data from request body
      const { price, mode, success_url, cancel_url, metadata } = req.body;

      if (!price || !success_url || !cancel_url) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      console.log('Creating checkout session with metadata:', metadata);

      // Get the customer ID from Firestore
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found' });
      }

      const userData = userDoc.data();
      let { stripeCustomerId } = userData;

      // If customer doesn't exist in Stripe yet, create one
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: decodedToken.email,
          metadata: {
            firebaseUID: uid,
          },
        });
        stripeCustomerId = customer.id;

        // Update the user document
        await admin.firestore().collection('users').doc(uid).update({
          stripeCustomerId,
        });
      }

      // Normalize metadata to ensure all fields are present
      const normalizedMetadata = {
        firebaseUID: uid,
        searchCredits: metadata?.searchCredits?.toString() || '0',
        productName: metadata?.productName || 'VIN Search Credits',
        membershipType: metadata?.membershipType || 'free',
        durationDays: metadata?.durationDays || '365',
        ...metadata,
      };

      // Create a checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        line_items: [
          {
            price: price,
            quantity: 1,
          },
        ],
        mode: mode || 'payment', // one-time payment by default
        success_url,
        cancel_url,
        metadata: normalizedMetadata,
      });

      console.log(`Created checkout session: ${session.id} for user: ${uid}`);
      console.log(`Session metadata:`, session.metadata);

      // Return the session URL directly (Firebase Extension format)
      return res.status(200).json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

// Function to access directly via Firebase SDK
exports.createCheckoutSession = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be logged in'
      );
    }

    try {
      const {
        price,
        successUrl,
        cancelUrl,
        searchCredits,
        productName,
        membershipType,
        durationDays,
        metadata = {},
      } = data;

      console.log('Creating checkout session with data:', {
        price,
        successUrl,
        cancelUrl,
        searchCredits,
        productName,
        membershipType,
        durationDays,
        metadata,
      });

      // Get the customer ID from Firestore
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(context.auth.uid)
        .get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User document not found'
        );
      }

      const userData = userDoc.data();
      let { stripeCustomerId } = userData;

      // If customer doesn't exist in Stripe yet, create one
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: context.auth.token.email,
          metadata: {
            firebaseUID: context.auth.uid,
          },
        });
        stripeCustomerId = customer.id;

        // Update the user document
        await admin
          .firestore()
          .collection('users')
          .doc(context.auth.uid)
          .update({
            stripeCustomerId,
          });
      }

      // Prepare all metadata fields
      const sessionMetadata = {
        firebaseUID: context.auth.uid,
        searchCredits: searchCredits?.toString() || '0',
        productName: productName || 'VIN Search Credits',
        membershipType: membershipType || 'free',
        durationDays: durationDays?.toString() || '365',
        // Include any other metadata fields
        ...metadata,
      };

      console.log('Creating checkout session with metadata:', sessionMetadata);

      // Create a checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        line_items: [
          {
            price,
            quantity: 1,
          },
        ],
        mode: 'payment', // one-time payment
        success_url: successUrl || data.success_url,
        cancel_url: cancelUrl || data.cancel_url,
        metadata: sessionMetadata,
      });

      console.log(
        `Created checkout session: ${session.id} for user: ${context.auth.uid}`
      );
      return { sessionId: session.id, url: session.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// Create a Stripe Portal session for managing payments
exports.createPortalSession = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const { stripeCustomerId } = userDoc.data();

    if (!stripeCustomerId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User does not have a Stripe customer ID'
      );
    }

    // Create a Stripe Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: appUrl + '/user-account',
    });

    return { url: session.url };
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Consolidated webhook handler for Stripe events (MAIN HANDLER)
// No CORS needed for webhooks, they're called by Stripe, not the browser
exports.stripeWebhookHandler = functions.https.onRequest(async (req, res) => {
  try {
    // Add more logging to debug webhook handling
    console.log(
      'Webhook received:',
      req.headers['stripe-signature'] ? 'Signature present' : 'No signature'
    );
    console.log('Webhook raw body:', req.rawBody ? 'Present' : 'Missing');

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'],
        webhookSecret
      );
      console.log(`✅ Webhook verified: ${event.type}`);
    } catch (err) {
      console.error(`⚠️ Webhook signature verification failed:`, err);
      console.error(
        'Webhook secret used:',
        webhookSecret ? 'Secret exists' : 'No secret found'
      );
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      console.log(`Processing completed checkout session: ${session.id}`);
      console.log(`Session metadata:`, session.metadata);

      // Extract firebaseUID and other data from metadata
      const firebaseUID = session.metadata?.firebaseUID;
      const searchCredits = session.metadata?.searchCredits;
      const productName = session.metadata?.productName;
      const membershipType = session.metadata?.membershipType;
      const durationDays = session.metadata?.durationDays;

      console.log('Extracted metadata:', {
        firebaseUID,
        searchCredits,
        productName,
        membershipType,
        durationDays,
      });

      if (!firebaseUID) {
        console.error('⚠️ No firebaseUID found in session metadata');
        return res.status(400).send(`Error: No firebaseUID in metadata`);
      }

      try {
        // Get user's current data
        const userRef = admin.firestore().collection('users').doc(firebaseUID);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          console.error(`⚠️ User document not found for UID: ${firebaseUID}`);
          return res.status(404).send(`Error: User document not found`);
        }

        const userData = userDoc.data();
        console.log(`User data retrieved:`, {
          uid: firebaseUID,
          currentSearchLimit: userData.searchLimit || 0,
          currentSearchesUsed: userData.searchesUsed || 0,
        });

        // Calculate new search limit
        const currentSearchLimit = userData.searchLimit || 0;
        const additionalSearches = parseInt(searchCredits || '0', 10);
        const newSearchLimit = currentSearchLimit + additionalSearches;

        console.log(
          `Updating search limit: ${currentSearchLimit} + ${additionalSearches} = ${newSearchLimit}`
        );

        // Calculate membership expiration date if provided
        let expirationDate = null;
        if (durationDays) {
          expirationDate = new Date();
          expirationDate.setDate(
            expirationDate.getDate() + parseInt(durationDays, 10)
          );
          console.log(
            `Setting expiration date to: ${expirationDate.toISOString()}`
          );
        }

        // Update user's search limits and membership in Firestore
        const updateData = {
          searchLimit: newSearchLimit,
          lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
          lastPaymentAmount: session.amount_total / 100, // Convert from cents to dollars
          lastPaymentId: session.payment_intent,
          paymentHistory: admin.firestore.FieldValue.arrayUnion({
            date: new Date(),
            productName: productName || 'VIN Search Credits',
            amount: session.amount_total / 100,
            paymentId: session.payment_intent,
            searchesAdded: additionalSearches,
          }),
        };

        // Only update membership level if it's provided and different from 'free'
        if (membershipType && membershipType !== 'free') {
          updateData.membership = membershipType;
          console.log(`Updating membership to: ${membershipType}`);
        }

        // Only add expiration date if it was calculated
        if (expirationDate) {
          updateData.expirationDate =
            admin.firestore.Timestamp.fromDate(expirationDate);
        }

        try {
          await userRef.update(updateData);
          console.log(
            `✅ User document updated successfully with:`,
            updateData
          );
        } catch (updateError) {
          console.error('❌ Failed to update user document:', updateError);
          // Still continue to try to record the transaction
        }

        // Record the transaction
        try {
          const transactionRef = await admin
            .firestore()
            .collection('transactions')
            .add({
              userId: firebaseUID,
              stripePaymentId: session.payment_intent,
              checkoutSessionId: session.id,
              productName: productName || 'VIN Search Credits',
              amount: session.amount_total / 100,
              searchesAdded: additionalSearches,
              membershipType: membershipType || 'free',
              membershipDuration: durationDays || null,
              timestamp: admin.firestore.Timestamp.serverTimestamp(),
            });

          console.log(`✅ Transaction recorded with ID: ${transactionRef.id}`);
        } catch (transactionError) {
          console.error('❌ Failed to record transaction:', transactionError);
        }

        console.log(
          `✅ Payment processing completed for session: ${session.id}`
        );
      } catch (error) {
        console.error(`⚠️ Error processing checkout session:`, error);
        return res.status(500).send(`Processing Error: ${error.message}`);
      }
    } else if (event.type === 'checkout.session.async_payment_succeeded') {
      // Process async payments with the same logic
      const session = event.data.object;
      console.log(`Async payment succeeded for session: ${session.id}`);
      // Process similar to checkout.session.completed
      // This event would use the same logic as checkout.session.completed
      // You could call a shared function here to avoid duplicating code
    } else {
      // Handle other events
      console.log(
        `Received event of type: ${event.type} - acknowledged but no action taken`
      );
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).send({ received: true });
  } catch (error) {
    console.error(`⚠️ Webhook general error:`, error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

// Get user's payment history and search limits with CORS support
exports.getPaymentDetailsApi = functions.https.onRequest(
  handleCors(async (req, res) => {
    try {
      // Verify authentication from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;

      // Get user data
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found' });
      }

      const userData = userDoc.data();

      // Get transactions for this user
      const transactionsSnapshot = await admin
        .firestore()
        .collection('transactions')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const transactions = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          date: data.timestamp ? data.timestamp.toDate() : new Date(),
          amount: data.amount || 0,
          productName: data.productName || 'VIN Search Credits',
          searchesAdded: data.searchesAdded || 0,
          paymentId: data.stripePaymentId || '',
          membershipType: data.membershipType || 'free',
        });
      });

      // Include membership details in the response
      return res.status(200).json({
        searchLimit: userData.searchLimit || 0,
        searchesUsed: userData.searchesUsed || 0,
        membershipLevel: userData.membership || 'free',
        expirationDate: userData.expirationDate
          ? userData.expirationDate.toDate()
          : null,
        lastPayment: userData.lastPaymentDate
          ? {
              date: userData.lastPaymentDate.toDate(),
              amount: userData.lastPaymentAmount || 0,
              id: userData.lastPaymentId || '',
            }
          : null,
        paymentHistory: transactions,
      });
    } catch (error) {
      console.error('Error getting payment details:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

// Get payment details for callable function (no CORS needed)
exports.getPaymentDetails = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const userData = userDoc.data();

    // Get user's payment history from transactions collection
    const transactionsSnapshot = await admin
      .firestore()
      .collection('transactions')
      .where('userId', '==', context.auth.uid)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const transactions = [];
    transactionsSnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        date: data.timestamp ? data.timestamp.toDate() : new Date(),
        amount: data.amount || 0,
        productName: data.productName || 'VIN Search Credits',
        searchesAdded: data.searchesAdded || 0,
        paymentId: data.stripePaymentId || '',
        membershipType: data.membershipType || 'free',
      });
    });

    return {
      searchLimit: userData.searchLimit || 0,
      searchesUsed: userData.searchesUsed || 0,
      membershipLevel: userData.membership || 'free',
      expirationDate: userData.expirationDate
        ? userData.expirationDate.toDate()
        : null,
      lastPayment: userData.lastPaymentDate
        ? {
            date: userData.lastPaymentDate.toDate(),
            amount: userData.lastPaymentAmount || 0,
            id: userData.lastPaymentId || '',
          }
        : null,
      paymentHistory: transactions,
    };
  } catch (error) {
    console.error('Error getting payment details:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Add HTTP versions of these functions to handle CORS
// Get a user's search limit with CORS support
exports.getSearchLimitApi = functions.https.onRequest(
  handleCors(async (req, res) => {
    try {
      // Verify authentication from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;

      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found' });
      }

      const userData = userDoc.data();
      return res.status(200).json(userData.searchLimit || 0);
    } catch (error) {
      console.error('Error getting search limit:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

// Get a user's searches used with CORS support
exports.getSearchesUsedApi = functions.https.onRequest(
  handleCors(async (req, res) => {
    try {
      // Verify authentication from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;

      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found' });
      }

      const userData = userDoc.data();
      return res.status(200).json(userData.searchesUsed || 0);
    } catch (error) {
      console.error('Error getting searches used:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

// Get a user's search limit using callable function
exports.getSearchLimit = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const userData = userDoc.data();
    return userData.searchLimit || 0;
  } catch (error) {
    console.error('Error getting search limit:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Get a user's searches used using callable function
exports.getSearchesUsed = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const userData = userDoc.data();
    return userData.searchesUsed || 0;
  } catch (error) {
    console.error('Error getting searches used:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// API to check if a user can search (HTTP version with CORS)
exports.checkSearchCreditsApi = functions.https.onRequest(
  handleCors(async (req, res) => {
    try {
      // Verify authentication from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const uid = decodedToken.uid;

      // Get user data
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found' });
      }

      const userData = userDoc.data();
      const searchesUsed = userData.searchesUsed || 0;
      const searchLimit = userData.searchLimit || 0;

      // Check if account has expired (if there's an expiration date)
      let isExpired = false;
      if (userData.expirationDate) {
        const expDate = userData.expirationDate.toDate();
        isExpired = expDate < new Date();
      }

      return res.status(200).json({
        searchesUsed,
        searchLimit,
        remainingSearches: searchLimit - searchesUsed,
        canSearch: searchesUsed < searchLimit && !isExpired,
        membership: userData.membership || 'free',
        isExpired,
        expirationDate: userData.expirationDate
          ? userData.expirationDate.toDate()
          : null,
      });
    } catch (error) {
      console.error('Error checking search credits:', error);
      return res.status(500).json({ error: error.message });
    }
  })
);

// Increment user's search count
exports.incrementSearchCount = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userRef = admin.firestore().collection('users').doc(context.auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const userData = userDoc.data();
    const searchesUsed = (userData.searchesUsed || 0) + 1;
    const searchLimit = userData.searchLimit || 0;

    // Check if the user has exceeded their search limit
    if (searchesUsed > searchLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Search limit exceeded'
      );
    }

    // Update the searchesUsed field
    await userRef.update({
      searchesUsed,
      lastSearchDate: admin.firestore.FieldValue.serverTimestamp(),
      lastSearchTime: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      searchesUsed,
      searchLimit,
      remainingSearches: searchLimit - searchesUsed,
    };
  } catch (error) {
    console.error('Error incrementing search count:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Function to check if a user has remaining searches
exports.checkSearchCredits = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userRef = admin.firestore().collection('users').doc(context.auth.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User document not found'
      );
    }

    const userData = userDoc.data();
    const searchesUsed = userData.searchesUsed || 0;
    const searchLimit = userData.searchLimit || 0;

    // Check if account has expired (if there's an expiration date)
    let isExpired = false;
    if (userData.expirationDate) {
      const expDate = userData.expirationDate.toDate();
      isExpired = expDate < new Date();
    }

    return {
      searchesUsed,
      searchLimit,
      remainingSearches: searchLimit - searchesUsed,
      canSearch: searchesUsed < searchLimit && !isExpired,
      membership: userData.membership || 'free',
      isExpired,
      expirationDate: userData.expirationDate
        ? userData.expirationDate.toDate()
        : null,
    };
  } catch (error) {
    console.error('Error checking search credits:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Reset search count for testing purposes
exports.resetSearchCount = functions.https.onCall(async (_, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  try {
    const userRef = admin.firestore().collection('users').doc(context.auth.uid);
    await userRef.update({
      searchesUsed: 0,
    });

    return {
      success: true,
      message: 'Search count reset successfully',
    };
  } catch (error) {
    console.error('Error resetting search count:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Debug and manual credit adjustment function (for testing only)
exports.debugAddSearchCredits = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be logged in'
      );
    }

    // Only allow in non-production environment or for admin users
    const isAdmin = context.auth.token.admin === true;
    if (process.env.NODE_ENV === 'production' && !isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This operation is not allowed in production without admin rights'
      );
    }

    try {
      const { userId, creditsToAdd } = data;
      const targetUserId = userId || context.auth.uid;
      const credits = parseInt(creditsToAdd || '1', 10);

      if (isNaN(credits) || credits <= 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Credits to add must be a positive number'
        );
      }

      const userRef = admin.firestore().collection('users').doc(targetUserId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User document not found'
        );
      }

      const userData = userDoc.data();
      const currentLimit = userData.searchLimit || 0;
      const newLimit = currentLimit + credits;

      await userRef.update({
        searchLimit: newLimit,
        debugAdjusted: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        previousLimit: currentLimit,
        newLimit,
        added: credits,
        date: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error adding debug search credits:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  }
);

// Debug status endpoint - useful for checking if functions are responding correctly
exports.status = functions.https.onRequest(
  handleCors(async (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      region: process.env.FUNCTION_REGION || 'unknown',
      projectId: process.env.GCLOUD_PROJECT || 'unknown',
      environment: process.env.NODE_ENV || 'development',
    });
  })
);

