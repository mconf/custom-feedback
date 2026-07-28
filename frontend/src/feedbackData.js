import { createContext, useContext } from 'react';

const FEEDBACK_DATA_PATH = '/feedback/feedbackData.json';

export const fetchFeedbackData = async () => {
  try {
    const res = await fetch(FEEDBACK_DATA_PATH);
    const isJson = res.headers.get('content-type')?.includes('application/json');

    if (res.ok && isJson) return await res.json();

    console.error('Error loading feedback data: file not found or not JSON');
  } catch (error) {
    console.error('Error loading feedback data:', error);
  }

  return {};
};

export const FeedbackDataContext = createContext({});

export const useFeedbackData = () => useContext(FeedbackDataContext);
