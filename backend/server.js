import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from 'redis';
import request from 'request';
import path from 'path';

import Logger from './lib/logger.js';

const app = express();
const port = process.env.PORT || 3009;

const FEEDBACK_URL = process.env.FEEDBACK_URL;

const redisClient = createClient();

redisClient.on('error', (err) => Logger.error('Redis Client Error', err));

await redisClient.connect();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/feedback', express.static(path.resolve('./public')));

app.post('/feedback/webhook', async (req, res) => {
  try {
    const { event, domain } = req.body;
    const events = JSON.parse(event);

    Logger.info(`Got webhook ${event} from ${domain}`);
    for (const evt of events) {
      if (evt.data.type === 'event') {
        const eventType = evt.data.id;

        if (eventType === 'meeting-created') {
          const meeting = evt.data.attributes.meeting;
          const sessionData = {
            session_name: meeting.name,
            institution_name: domain,
            institution_guid: meeting['external-meeting-id'],
            session_id: meeting['internal-meeting-id'],
          };

          await redisClient.hSet(`session:${meeting['internal-meeting-id']}`, sessionData);
        } else if (eventType === 'user-joined') {
          const user = evt.data.attributes.user;
          const userData = {
            name: user.name,
            id: user['internal-user-id'],
            role: user.role,
          };

          await redisClient.hSet(`user:${user['internal-user-id']}`, userData);
        }
      }
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    Logger.error("Error processing webhook:", error);
    res.status(500).send();
  }
});

app.post('/feedback/submit', async (req, res) => {
  try {
    const { session, user, feedback, device, rating } = req.body;

    const sessionData = await redisClient.hGetAll(`session:${session.sessionId}`);
    const userData = await redisClient.hGetAll(`user:${user.userId}`);

    Logger.info(`Submitting feedback for userID: ${userData.id} meetingID: ${sessionData.session_id}`);

    const completeFeedback = {
      rating,
      session: {
        session_name: sessionData.session_name,
        institution_name: sessionData.institution_name,
        institution_guid: sessionData.institution_guid,
        session_id: sessionData.session_id
      },
      device,
      user: {
        name: userData.name,
        id: userData.id,
        role: userData.role,
        email: user.email
      },
      feedback
    };

    request.post(
	FEEDBACK_URL,
	{ json: completeFeedback },
        (error, response, body) => {
            if (!error && response.statusCode === 200) {
            } else {
                Logger.error('Failed to send feedback to final URL', error);
            }
        }
    );

    res.json({ status: 'success', data: completeFeedback });
  } catch (error) {
    Logger.error('Error submitting feedback:', error);
    res.status(500).send();
  }
});

app.listen(port, () => {
  Logger.info(`Server listening on port ${port}`);
});
