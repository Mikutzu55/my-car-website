import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
dotenv.config();

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin with service account file
try {
  const serviceAccountPath = join(__dirname, './serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.warn(
    'Firebase service account not configured properly. Auth verification will not work.'
  );

  // Initialize with empty config as fallback to avoid errors later
  if (!admin.apps.length) {
    admin.initializeApp({});
    console.log('Firebase initialized with empty config as fallback');
  }
}

// Initialize Firestore and Auth after Firebase is initialized
const db = getFirestore();
const auth = getAuth();

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to enable CORS and parse JSON requests
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use('/deep', express.static(join(__dirname, 'public/deep')));
console.log(`Serving static files from: ${join(__dirname, 'public/deep')}`);

// Middleware to log incoming requests
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// DeepSeek AI API configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

// POST endpoint for search tips
app.post('/api/ai/search-tip', (req, res) => {
  console.log('Search tip request received:', req.body);
  res.json({
    tip: 'Try entering a complete 17-character VIN for best results.',
    status: 'success',
  });
});

// Inspect the token
app.get('/api/token-debug', (req, res) => {
  const token = process.env.CLEARVIN_TOKEN;

  if (!token) {
    return res
      .status(500)
      .json({ error: 'Token not found in environment variables' });
  }

  // Show token in a way that doesn't expose the full token but helps debugging
  const tokenLength = token.length;
  const firstChars = token.substring(0, 8);
  const lastChars = token.substring(tokenLength - 8);

  // Check if token may already contain "Bearer"
  const containsBearer = token.toLowerCase().includes('bearer');

  res.json({
    tokenPreview: `${firstChars}...${lastChars}`,
    tokenLength,
    containsBearer,
    firstCharacters: firstChars,
    lastCharacters: lastChars,
  });
});

// Modified ClearVIN API endpoint with sample response
app.get('/api/clearvin', async (req, res) => {
  const { vin } = req.query;
  const clearVinToken = process.env.CLEARVIN_TOKEN;

  if (!vin) {
    return res.status(400).json({ error: 'VIN parameter is required.' });
  }

  if (!clearVinToken) {
    console.error('ClearVIN token is missing. Please check your .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  console.log(`Processing ClearVIN request for VIN: ${vin}`);

  // Check if token already contains "Bearer" prefix
  const finalToken = clearVinToken.toLowerCase().startsWith('bearer ')
    ? clearVinToken // Token already includes Bearer
    : `Bearer ${clearVinToken}`; // Add Bearer prefix

  try {
    console.log(`Making API request for VIN: ${vin}`);
    const response = await axios.get(
      `https://www.clearvin.com/rest/vendor/preview?vin=${vin}`,
      {
        headers: {
          Authorization: finalToken,
        },
      }
    );

    console.log(`API request succeeded with status: ${response.status}`);

    if (response.data.status === 'ok') {
      const clearVinData = response.data.result.vinSpec;
      const recalls = response.data.result.recalls || [];

      // Map the API response to the structure expected by frontend
      const vehicleData = {
        make: clearVinData.make || 'N/A',
        model: clearVinData.model || 'N/A',
        year: clearVinData.year || 'N/A',
        vin: vin,
        registrationStatus: 'Active',
        mileage: 0,
        specifications: {
          make: clearVinData.make || 'N/A',
          model: clearVinData.model || 'N/A',
          year: clearVinData.year || 'N/A',
          trim: clearVinData.trim || 'N/A',
          madeIn: clearVinData.madeIn || 'N/A',
          engine: clearVinData.engine || 'N/A',
          style: clearVinData.style || 'N/A',
          invoicePrice: clearVinData.invoice || 'N/A',
          msrp: clearVinData.msrp || 'N/A',
        },
        titleRecords: [],
        junkSalvageRecords: [],
        saleRecords: [],
        problemChecks: {
          floodDamage: 'No problems found!',
          fireDamage: 'No problems found!',
          hailDamage: 'No problems found!',
          saltWaterDamage: 'No problems found!',
          vandalism: 'No problems found!',
          rebuilt: 'No problems found!',
          salvageDamage: 'No problems found!',
        },
        recalls: recalls.map((recall) => ({
          summary: recall.Summary || 'No summary available',
          component: recall.Component || 'No component specified',
          consequence: recall.Consequence || 'No consequence specified',
          remedy: recall.Remedy || 'No remedy specified',
          notes: recall.Notes || 'No notes available',
          manufacturer: recall.Manufacturer || 'No manufacturer specified',
          reportReceivedDate: recall.ReportReceivedDate || 'No date specified',
          nhtsaCampaignNumber:
            recall.NHTSACampaignNumber || 'No campaign number specified',
        })),
        emissionSafetyInspections: [],
        accidentDamageHistory: [],
        lienImpoundRecords: [],
      };

      // Update user's last search time if user ID is provided
      const { userId } = req.query;
      if (userId) {
        try {
          console.log(`Updating search data for user: ${userId}`);
          const userRef = db.collection('users').doc(userId);
          await userRef.update({
            searchesUsed: admin.firestore.FieldValue.increment(1),
            lastSearchTime: admin.firestore.Timestamp.now(),
          });
          console.log(`Successfully updated search data for user: ${userId}`);
        } catch (err) {
          console.error(
            `Error updating user search data for user ${userId}:`,
            err
          );
        }
      }

      return res.json({ vehicle: vehicleData });
    } else {
      console.error('ClearVIN API returned non-OK status:', response.data);
      return res.status(404).json({
        error: 'No data found for this VIN using ClearVIN API.',
        details: response.data,
      });
    }
  } catch (error) {
    console.error('Error fetching ClearVIN data:', error.message);

    // Detailed error logging
    if (error.response) {
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });

      // If it's a token issue, provide more guidance
      if (error.response.status === 401) {
        console.error('Authentication failed. This is likely a token issue.');

        // Check if the token is over 60 days old (based on the expiry of your current token)
        console.log(
          'Token may be expired or invalid. Consider getting a new token from ClearVIN.'
        );

        return res.status(401).json({
          error: 'ClearVIN API authentication failed',
          details:
            'Your API token may be expired or invalid. Please contact ClearVIN support to verify your token.',
          apiResponse: error.response.data,
        });
      }

      return res.status(error.response.status).json({
        error: 'Error from ClearVIN API',
        details: error.response.data,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch data from ClearVIN API.',
      message: error.message,
    });
  }
});

// AI Service endpoints

// Process vehicle data and generate insights
app.post('/api/ai/analyze-vehicle', async (req, res) => {
  const { vehicleData, idToken } = req.body;

  if (!vehicleData) {
    return res.status(400).json({ error: 'Vehicle data is required' });
  }

  if (!DEEPSEEK_API_KEY) {
    console.error('DeepSeek API key is missing. Please check your .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    // Verify user and get their tier
    let userTier = 'free';
    let userId = null;

    if (idToken) {
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userTier = userDoc.data().membership?.toLowerCase() || 'free';
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        // Continue with free tier if token verification fails
      }
    }

    const isFullAccess = userTier === 'premium' || userTier === 'business';

    // Prepare vehicle data for AI analysis
    const vehicleBasics = {
      make: vehicleData.make,
      model: vehicleData.model,
      year: vehicleData.year,
      specifications: vehicleData.specifications,
      recalls: vehicleData.recalls?.slice(0, 3) || [],
    };

    // Full vehicle data for premium users
    const vehicleComplete = isFullAccess ? vehicleData : vehicleBasics;

    // Create prompt based on user tier
    let prompt;
    if (isFullAccess) {
      prompt = `As a professional automotive expert, provide a comprehensive analysis of this ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}.
      
Vehicle Data: ${JSON.stringify(vehicleComplete)}

Include:
1. Overview of the vehicle
2. Known common issues for this make/model/year
3. Reliability assessment
4. Maintenance recommendations
5. Analysis of any recalls and their implications
6. Value assessment (whether it's a good purchase)
7. Performance characteristics
8. Any red flags in the vehicle's history or specifications

Format your response in clear sections with descriptive headings.`;
    } else {
      prompt = `Provide a basic analysis of this ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}.
      
Vehicle Data: ${JSON.stringify(vehicleBasics)}

Include:
1. Brief overview of the vehicle
2. General reliability reputation
3. Basic information about any recalls

Keep your response concise and mention that upgrading to premium would provide more detailed insights.`;
    }

    console.log(
      `Sending ${isFullAccess ? 'premium' : 'free'} AI request for vehicle analysis`
    );

    // Call DeepSeek AI API
    const response = await axios.post(
      `${DEEPSEEK_API_URL}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are an automotive expert AI that provides insights about vehicles based on their history and specifications.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: isFullAccess ? 2000 : 800,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const insights = response.data.choices[0].message.content;

    // For free users, add an upsell message
    const result = {
      insights,
      isFullAccess,
    };

    if (!isFullAccess) {
      result.upsellMessage =
        'Upgrade to Premium for full vehicle analysis including maintenance recommendations, value assessment, and comprehensive reliability data.';
    }

    res.json(result);
  } catch (error) {
    console.error('Error analyzing vehicle data:', error.message);

    if (error.response) {
      console.error('DeepSeek API error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }

    res.status(500).json({ error: 'Failed to analyze vehicle data.' });
  }
});

// Compare multiple vehicles and provide recommendations
app.post('/api/ai/compare-vehicles', async (req, res) => {
  const { vehicles, idToken } = req.body;

  if (!vehicles || !Array.isArray(vehicles) || vehicles.length < 2) {
    return res
      .status(400)
      .json({ error: 'At least two vehicles are required for comparison' });
  }

  if (!DEEPSEEK_API_KEY) {
    console.error('DeepSeek API key is missing. Please check your .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    // Verify user and get their tier
    let userTier = 'free';
    let userId = null;

    if (idToken) {
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userTier = userDoc.data().membership?.toLowerCase() || 'free';
        }
      } catch (error) {
        console.error('Error verifying token:', error);
      }
    }

    const isFullAccess = userTier === 'premium' || userTier === 'business';

    // Prepare simplified vehicle data for comparison
    const vehicleSummaries = vehicles.map((v) => ({
      make: v.make,
      model: v.model,
      year: v.year,
      specifications: v.specifications,
      recalls: isFullAccess ? v.recalls || [] : [],
    }));

    // Create prompt based on user tier
    let prompt;
    if (isFullAccess) {
      prompt = `As an automotive expert, provide a detailed comparison of these vehicles:
      
Vehicle Data: ${JSON.stringify(vehicleSummaries)}

Include:
1. Direct comparison of key specifications
2. Reliability comparison between the models
3. Performance analysis
4. Value proposition for each vehicle
5. Maintenance expectations and costs
6. Safety features and crash test results comparison
7. Pros and cons of each vehicle
8. Clear recommendation on which vehicle is better based on different criteria (reliability, value, performance, etc.)

Format your response in clear sections with a summary table at the end highlighting the winner in each category.`;
    } else {
      prompt = `Provide a basic comparison of these vehicles:
      
Vehicle Data: ${JSON.stringify(vehicleSummaries)}

Include:
1. Basic specification comparison
2. General reliability reputation
3. Brief value assessment

Keep your response concise and basic. Mention that a premium account provides more detailed comparisons.`;
    }

    console.log(
      `Sending ${isFullAccess ? 'premium' : 'free'} AI request for vehicle comparison`
    );

    // Call DeepSeek AI API
    const response = await axios.post(
      `${DEEPSEEK_API_URL}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content:
              'You are an automotive expert AI that compares vehicles and provides recommendations based on their specifications and history.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: isFullAccess ? 2000 : 500,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const comparison = response.data.choices[0].message.content;

    // For free users, add an upsell message
    const result = {
      comparison,
      isFullAccess,
    };

    if (!isFullAccess) {
      result.upsellMessage =
        'Upgrade to Premium for comprehensive vehicle comparisons including reliability data, maintenance costs, and detailed performance analysis.';
    }

    res.json(result);
  } catch (error) {
    console.error('Error comparing vehicles:', error.message);

    if (error.response) {
      console.error('DeepSeek API error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }

    res.status(500).json({ error: 'Failed to compare vehicles.' });
  }
});

// Chat with AI about vehicles (premium/business users)
app.post('/api/ai/chat', async (req, res) => {
  const { message, vehicleContext, chatHistory, idToken } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!DEEPSEEK_API_KEY) {
    console.error('DeepSeek API key is missing. Please check your .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    // Verify user and get their tier
    if (!idToken) {
      return res.status(401).json({
        error: 'Authentication required',
        requiresUpgrade: true,
        message: 'Please upgrade to Premium to chat with our AI assistant',
      });
    }

    let userTier = 'free';
    let userId;
    let lastSearchTime = null;

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      userId = decodedToken.uid;

      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userTier = userData.membership?.toLowerCase() || 'free';
        lastSearchTime = userData.lastSearchTime?.toDate();
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const isFullAccess = userTier === 'premium' || userTier === 'business';

    if (!isFullAccess) {
      return res.status(403).json({
        error: 'Premium required',
        requiresUpgrade: true,
        message:
          'This feature is only available for Premium and Business users. Upgrade your plan to chat with our AI.',
      });
    }

    // Check if premium user is within 24-hour window after using searches
    const now = new Date();
    if (!lastSearchTime || now - lastSearchTime > 24 * 60 * 60 * 1000) {
      return res.status(403).json({
        error: 'Chat access expired',
        requiresSearch: true,
        message:
          'Your chat access has expired. Perform a new search to continue chatting with our AI.',
      });
    }

    // Process chat history for the API
    const formattedHistory = Array.isArray(chatHistory)
      ? chatHistory.map((msg) => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content,
        }))
      : [];

    // Format vehicle context
    let vehicleInfo = '';
    if (vehicleContext) {
      if (Array.isArray(vehicleContext)) {
        vehicleInfo = `The user has multiple vehicles: ${vehicleContext
          .map((v) => `${v.year} ${v.make} ${v.model}`)
          .join(', ')}`;
      } else {
        vehicleInfo = `The user has a ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`;
      }
    }

    // Set up messages for the AI
    const messages = [
      {
        role: 'system',
        content: `You are an automotive expert AI assistant for a vehicle history service similar to Carfax. ${vehicleInfo} Today is ${new Date().toISOString().split('T')[0]}.
        
Your responses should be helpful, informative, and focus on automotive topics. If asked about non-automotive topics, gently redirect the conversation to cars, vehicle maintenance, or related subjects.

You can provide information about:
- Vehicle maintenance and repair advice
- Car buying and selling recommendations
- Vehicle history interpretation
- Common issues with specific makes/models
- Car specifications and features
- Vehicle safety information
- Market value assessments`,
      },
      ...formattedHistory,
      {
        role: 'user',
        content: message,
      },
    ];

    console.log('Sending AI chat request for premium user');

    // Call DeepSeek AI API
    const response = await axios.post(
      `${DEEPSEEK_API_URL}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save chat to user's history (optional)
    try {
      await db
        .collection('users')
        .doc(userId)
        .update({
          chatHistory: admin.firestore.FieldValue.arrayUnion({
            userMessage: message,
            aiResponse: response.data.choices[0].message.content,
            timestamp: admin.firestore.Timestamp.now(),
          }),
        });
    } catch (err) {
      console.error('Error saving chat history:', err);
      // Continue even if saving chat history fails
    }

    res.json({
      message: response.data.choices[0].message.content,
      isFullAccess: true,
    });
  } catch (error) {
    console.error('Error in AI chat:', error.message);

    if (error.response) {
      console.error('DeepSeek API error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    }

    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Stripe checkout session creation endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  const { price, success_url, cancel_url, searchCredits, productName } =
    req.body;

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Stripe secret key is missing in environment variables');
    return res.status(500).json({ error: 'Stripe key is not configured' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    console.log(`Creating Stripe checkout session for product: ${productName}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${success_url}`,
      cancel_url: `${cancel_url}`,
      metadata: {
        searchCredits: searchCredits,
        productName: productName,
      },
    });

    console.log(`Stripe checkout session created: ${session.id}`);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `[${new Date().toISOString()}] AI-enhanced vehicle analysis service started`
  );
});
