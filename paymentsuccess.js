import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Alert, Spinner, Button, Card } from 'react-bootstrap';
import {
  FaCheckCircle,
  FaArrowRight,
  FaSearch,
  FaCrown,
  FaShieldAlt,
} from 'react-icons/fa';
import { auth, getPaymentDetails } from './firebase';

/**
 * Payment success page shown after a successful Stripe payment
 * This component will automatically redirect to the user account page
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    if (!auth.currentUser) {
      navigate('/login', {
        state: {
          from: '/payment-success',
          message: 'Please log in to view your payment details',
        },
      });
      return;
    }

    const plan = searchParams.get('plan');

    const fetchPaymentDetails = async () => {
      try {
        setLoading(true);
        // Get latest payment details
        const result = await getPaymentDetails();

        if (result && result.data) {
          setPaymentInfo({
            ...result.data,
            plan,
          });
        } else {
          throw new Error('Could not retrieve payment details');
        }
      } catch (err) {
        console.error('Error fetching payment details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentDetails();

    // Redirect after a delay
    const timer = setTimeout(() => {
      navigate('/user-account?payment_success=true&plan=' + (plan || ''), {
        replace: true,
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate, searchParams]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <div className="my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Processing your payment...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          <Alert.Heading>Error retrieving payment details</Alert.Heading>
          <p>{error}</p>
          <Button variant="primary" onClick={() => navigate('/user-account')}>
            Go to My Account
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Card className="shadow-sm border-0 p-4">
        <div className="text-center mb-4">
          <div className="success-icon mb-4">
            <FaCheckCircle size={80} className="text-success" />
          </div>
          <h1>Payment Successful!</h1>
          <p className="lead mb-4">Thank you for your purchase.</p>
        </div>

        {paymentInfo && (
          <Card.Body className="bg-light rounded p-4 mb-4">
            <h5 className="d-flex align-items-center mb-3">
              <FaCrown className="text-warning me-2" />
              Your Account Has Been Updated
            </h5>

            <div className="d-flex align-items-center mb-3">
              <div className="bg-primary rounded-circle p-3 me-3">
                <FaSearch className="text-white" />
              </div>
              <div>
                <h6 className="mb-1">Search Credits Added</h6>
                <p className="mb-0 fw-bold">
                  {paymentInfo.lastPayment?.searchesAdded ||
                    paymentInfo.paymentHistory?.[0]?.searchesAdded ||
                    'Your search credits have been'}
                </p>
              </div>
            </div>

            <div className="d-flex align-items-center">
              <div className="bg-success rounded-circle p-3 me-3">
                <FaShieldAlt className="text-white" />
              </div>
              <div>
                <h6 className="mb-1">Current Search Credits</h6>
                <p className="mb-0 fw-bold">
                  {paymentInfo.searchLimit - paymentInfo.searchesUsed} available
                </p>
              </div>
            </div>
          </Card.Body>
        )}

        <p className="text-muted text-center mb-4">
          You will be redirected to your account dashboard in a few seconds...
        </p>

        <div className="text-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/user-account', { replace: true })}
            className="px-4 py-2"
          >
            Go to My Account <FaArrowRight className="ms-2" />
          </Button>
        </div>
      </Card>

      <style jsx="true">{`
        .success-icon {
          color: #28a745;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.7;
          }
        }
      `}</style>
    </Container>
  );
};

export default PaymentSuccess;
