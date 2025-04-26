import React, { useState } from 'react';
import { Card, Button, Badge, Form, Spinner, Alert } from 'react-bootstrap';
import {
  FaCheck,
  FaStar,
  FaBriefcase,
  FaRocket,
  FaAward,
  FaShieldAlt,
  FaSyncAlt,
  FaBrain,
  FaCode,
  FaHeadset,
  FaFileExport,
  FaSearch,
  FaSearchDollar,
  FaBolt,
  FaTags,
} from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from './firebase'; // Import from your firebase.js
import { redirectToCheckout } from './stripe'; // Import from your stripe.js

const Pricing = ({ isEmbedded }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subscriptionType, setSubscriptionType] = useState('premium');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);
  const user = auth.currentUser; // Get current user from Firebase Auth

  // Detect if component is used inside user account
  const isInsideUserAccount =
    isEmbedded || location.pathname.includes('account');

  // Define plans with detailed metadata
  const plans = {
    premium: [
      {
        id: '1_search',
        name: 'Starter',
        price: 11.95,
        searches: 1,
        features: [
          '1 VIN search',
          'Basic vehicle details',
          'Email support',
          'AI vehicle analysis',
        ],
        bestValue: false,
        membershipType: 'premium',
        durationDays: 30, // 1 month access
        priceId: 'price_1RFgsEB084qIp5RaobF4Vcol', // Ensure this is your actual price ID
      },
      {
        id: '5_searches',
        name: 'Explorer',
        price: 40.95,
        searches: 5,
        features: [
          '5 VIN searches',
          'Detailed vehicle history',
          'AI vehicle analysis',
          'Email support',
          '24-hour chat assistance',
        ],
        bestValue: true,
        membershipType: 'premium',
        durationDays: 60, // 2 months access
        priceId: 'price_2OsXXXXXXXXXXXXXXXXXXXXX', // Replace with your actual price ID
      },
      {
        id: '8_searches',
        name: 'Pro',
        price: 59.95,
        searches: 8,
        features: [
          '8 VIN searches',
          'Full vehicle history',
          'Enhanced AI analysis',
          'Priority email support',
          '24-hour chat assistance',
        ],
        bestValue: false,
        membershipType: 'premium',
        durationDays: 90, // 3 months access
        priceId: 'price_3OsXXXXXXXXXXXXXXXXXXXXX', // Replace with your actual price ID
      },
    ],
    business: [
      {
        id: '20_searches',
        name: 'Small Business',
        price: 149.99,
        searches: 20,
        features: [
          '20 VIN searches',
          'API access',
          'Advanced AI analysis',
          'Dedicated account manager',
          'Bulk report exports',
        ],
        bestValue: false,
        membershipType: 'business',
        durationDays: 180, // 6 months access
        priceId: 'price_4OsXXXXXXXXXXXXXXXXXXXXX', // Replace with your actual price ID
      },
      {
        id: '50_searches',
        name: 'Enterprise',
        price: 374.99,
        searches: 50,
        features: [
          '50 VIN searches',
          'API access',
          'Premium AI analysis',
          '24/7 priority support',
          'Custom data exports',
        ],
        bestValue: true,
        membershipType: 'business',
        durationDays: 270, // 9 months access
        priceId: 'price_5OsXXXXXXXXXXXXXXXXXXXXX', // Replace with your actual price ID
      },
      {
        id: '100_searches',
        name: 'Corporate',
        price: 589.99,
        searches: 100,
        features: [
          '100 VIN searches',
          'API access',
          'Premium AI analysis',
          'Custom integrations',
          'Dedicated support team',
        ],
        bestValue: false,
        membershipType: 'business',
        durationDays: 365, // 12 months access
        priceId: 'price_6OsXXXXXXXXXXXXXXXXXXXXX', // Replace with your actual price ID
      },
    ],
  };

  const handleCheckout = async (plan) => {
    if (!user) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }

    setLoadingPlan(plan.id);
    setError(null);

    try {
      console.log(
        `Initiating checkout for plan ${plan.id} with priceId ${plan.priceId}`
      );

      // Success and cancel URLs
      const success_url = isInsideUserAccount
        ? `${window.location.origin}/user-account?payment_success=true&plan=${encodeURIComponent(plan.id)}`
        : `${window.location.origin}/user-account?payment_success=true&plan=${encodeURIComponent(plan.id)}`;

      const cancel_url = isInsideUserAccount
        ? `${window.location.origin}/user-account?payment_canceled=true`
        : `${window.location.origin}/pricing?payment_canceled=true`;

      // Create checkout session with all required metadata for the webhook
      await redirectToCheckout({
        price: plan.priceId,
        success_url,
        cancel_url,
        // Include all necessary metadata for the webhook handler
        searchCredits: plan.searches.toString(),
        productName: `${plan.name} - ${plan.searches} Searches`,
        membershipType: plan.membershipType || subscriptionType,
        durationDays: plan.durationDays.toString(),
        // Duplicate important fields in metadata for redundancy
        metadata: {
          planId: plan.id,
          planName: plan.name,
          searchCredits: plan.searches.toString(),
          searchCount: plan.searches.toString(),
          membershipType: plan.membershipType || subscriptionType,
          membershipLevel: plan.membershipType || subscriptionType,
          durationDays: plan.durationDays.toString(),
          validityPeriod: plan.durationDays.toString(),
        },
      });

      // Note: redirectToCheckout will navigate away from this page
      // The code below won't execute since the page navigates
    } catch (err) {
      console.error('Payment error:', err);
      setError(`Payment error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  // Function to get plan duration display
  const getDurationText = (days) => {
    if (days >= 365) return `${days / 365} year access`;
    if (days >= 30) return `${Math.round(days / 30)} month access`;
    return `${days} day access`;
  };

  // Function to get icon for a feature based on the text
  const getFeatureIcon = (feature) => {
    if (feature.toLowerCase().includes('ai'))
      return <FaBrain className="text-primary me-2" />;
    if (feature.toLowerCase().includes('api'))
      return <FaCode className="text-info me-2" />;
    if (
      feature.toLowerCase().includes('priority') ||
      feature.toLowerCase().includes('dedicated')
    )
      return <FaAward className="text-warning me-2" />;
    if (feature.toLowerCase().includes('export'))
      return <FaFileExport className="text-secondary me-2" />;
    if (
      feature.toLowerCase().includes('chat') ||
      feature.toLowerCase().includes('support')
    )
      return <FaHeadset className="text-success me-2" />;
    return <FaCheck className="text-success me-2" />;
  };

  return (
    <div className={`container ${isInsideUserAccount ? 'p-0' : 'mt-5'}`}>
      {!isInsideUserAccount && (
        <>
          <h2 className="text-center mb-2">Choose Your Plan</h2>
          <p className="text-center text-muted mb-4">
            Get unlimited access to premium vehicle insights and analysis
          </p>
        </>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <div className="text-center mb-4">
        <div className="plan-toggle-container d-inline-block bg-light p-2 rounded-pill">
          <Button
            variant={subscriptionType === 'premium' ? 'primary' : 'light'}
            className="rounded-pill me-1"
            onClick={() => setSubscriptionType('premium')}
          >
            <FaStar className="me-2" /> Personal
          </Button>
          <Button
            variant={subscriptionType === 'business' ? 'primary' : 'light'}
            className="rounded-pill"
            onClick={() => setSubscriptionType('business')}
          >
            <FaBriefcase className="me-2" /> Business
          </Button>
        </div>
      </div>

      <div className="row">
        {plans[subscriptionType].map((plan) => (
          <div
            key={plan.id}
            className={`${isInsideUserAccount ? 'col-lg-4' : 'col-md-4'} mb-4`}
          >
            <Card
              className={`h-100 pricing-card shadow ${plan.bestValue ? 'border-primary popular-plan' : ''}`}
              style={{
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
              }}
            >
              {plan.bestValue && (
                <div className="popular-badge">
                  <Badge bg="primary" pill>
                    Most Popular
                  </Badge>
                </div>
              )}

              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-3">
                  <h4 className="plan-name">{plan.name}</h4>
                  <div className="price-container">
                    <span className="currency">$</span>
                    <span className="price">{plan.price}</span>
                    <span className="period">one-time</span>
                  </div>
                  <div className="d-flex justify-content-center mt-2">
                    <Badge bg="info" className="search-count-badge">
                      <FaSearch className="me-1" /> {plan.searches} Searches
                    </Badge>
                    <Badge bg="secondary" className="ms-2 duration-badge">
                      <FaSyncAlt className="me-1" />{' '}
                      {getDurationText(plan.durationDays)}
                    </Badge>
                  </div>
                </div>

                <hr />

                <h6 className="text-uppercase fw-bold mb-3 feature-heading">
                  <FaShieldAlt className="me-2" />
                  Plan Features
                </h6>

                <ul className="feature-list mb-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="feature-item">
                      {getFeatureIcon(feature)}
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.bestValue ? 'primary' : 'outline-primary'}
                  className="mt-auto w-100 py-2 checkout-button"
                  onClick={() => handleCheckout(plan)}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Processing...
                    </>
                  ) : (
                    <>Get Started</>
                  )}
                </Button>
              </Card.Body>

              {!isInsideUserAccount && (
                <Card.Footer className="text-center bg-transparent border-0 pb-3">
                  <small className="text-muted satisfaction-guarantee">
                    <FaShieldAlt className="me-1" /> 30-day satisfaction
                    guarantee
                  </small>
                </Card.Footer>
              )}
            </Card>
          </div>
        ))}
      </div>

      {!isInsideUserAccount && (
        <div className="text-center mt-5 benefits-section p-4 rounded bg-light">
          <h4 className="mb-4">Why Choose Our Vehicle Reports?</h4>

          <div className="row">
            <div className="col-md-4 mb-3">
              <div className="benefit-item">
                <div className="benefit-icon">
                  <FaSearchDollar />
                </div>
                <h5>Save Money</h5>
                <p className="text-muted">
                  Get comprehensive reports for a fraction of dealer prices
                </p>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="benefit-item">
                <div className="benefit-icon">
                  <FaBrain />
                </div>
                <h5>AI-Powered Analysis</h5>
                <p className="text-muted">
                  Get smart insights and recommendations for any vehicle
                </p>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="benefit-item">
                <div className="benefit-icon">
                  <FaBolt />
                </div>
                <h5>Instant Results</h5>
                <p className="text-muted">
                  Reports delivered in seconds, not hours or days
                </p>
              </div>
            </div>
          </div>

          {!user && (
            <Button
              variant="success"
              size="lg"
              className="mt-4 cta-button"
              onClick={() => navigate('/signup')}
            >
              <FaRocket className="me-2" />
              Sign Up for Free
            </Button>
          )}
        </div>
      )}

      <style jsx="true">{`
        .pricing-card {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #eaeaea;
        }

        .popular-plan {
          transform: scale(1.03);
          border-width: 2px;
          position: relative;
          z-index: 1;
        }

        .popular-badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2;
        }

        .plan-name {
          font-weight: 700;
          margin-bottom: 5px;
        }

        .price-container {
          margin-bottom: 10px;
        }

        .currency {
          font-size: 1.5rem;
          vertical-align: top;
          position: relative;
          top: 10px;
        }

        .price {
          font-size: 3rem;
          font-weight: 700;
        }

        .period {
          font-size: 0.9rem;
          color: #6c757d;
          margin-left: 5px;
        }

        .search-count-badge,
        .duration-badge {
          padding: 0.5rem 0.8rem;
          font-weight: 500;
        }

        .feature-heading {
          font-size: 0.85rem;
          color: #6c757d;
        }

        .feature-list {
          list-style: none;
          padding-left: 0;
        }

        .feature-item {
          margin-bottom: 12px;
          display: flex;
          align-items: flex-start;
          font-size: 0.95rem;
        }

        .checkout-button {
          border-radius: 50px;
          font-weight: 500;
          font-size: 1.1rem;
        }

        .satisfaction-guarantee {
          font-size: 0.8rem;
        }

        .benefits-section {
          margin-top: 60px;
          border-radius: 15px;
        }

        .benefit-item {
          padding: 1.5rem;
          text-align: center;
        }

        .benefit-icon {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: #4a6fee;
        }

        .cta-button {
          padding: 0.8rem 2rem;
          font-weight: 600;
          border-radius: 50px;
        }

        .plan-toggle-container {
          margin-bottom: 2rem;
        }

        @media (max-width: 768px) {
          .popular-plan {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Pricing;

