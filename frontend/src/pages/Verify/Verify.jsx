import React, { useContext, useEffect, useState } from "react";
import "./Verify.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";

const Verify = () => {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success");
  const orderId = searchParams.get("orderId");
  const { url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const verifyPayment = async () => {
    try {
      setIsLoading(true);
      if (!orderId) {
        setError("Order ID is missing");
        setIsLoading(false);
        return;
      }

      const response = await axios.post(url + "/api/order/verify", {
        success,
        orderId,
      });

      if (response.data.success) {
        navigate("/myorders");
      } else {
        setError(response.data.message || "Payment verification failed");
        setTimeout(() => navigate("/"), 3000);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Error verifying payment";
      setError(errorMessage);
      
      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && error.message.includes("Network Error")) {
        setRetryCount(prev => prev + 1);
        setTimeout(verifyPayment, 2000); // Retry after 2 seconds
      } else {
        setTimeout(() => navigate("/"), 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, [orderId, success]); // Add dependencies

  return (
    <div className="verify">
      {error ? (
        <div className="error-message">
          {error}
          {retryCount > 0 && retryCount < MAX_RETRIES && (
            <p>Retrying... ({retryCount}/{MAX_RETRIES})</p>
          )}
        </div>
      ) : isLoading ? (
        <div className="spinner"></div>
      ) : null}
    </div>
  );
};

export default Verify;
