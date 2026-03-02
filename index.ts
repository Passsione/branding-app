// functions/src/index.ts
// =====================================================
// FIREBASE CLOUD FUNCTIONS
// Deploy: firebase deploy --only functions
// =====================================================

import app, { functions, db  } from './firebase/config';
import Stripe from 'stripe';



// Initialize Stripe (set secret key in Firebase config)
// firebase functions:config:set stripe.secret="sk_live_..."
const stripe = new Stripe(
  functions.config().stripe?.secret ?? process.env.STRIPE_SECRET_KEY ?? '',
  
);

// ─────────────────────────────────────────────
// FEED FAN-OUT ON POST CREATE
// ─────────────────────────────────────────────
// When a user creates a post, distribute it to all followers' feeds.
// For large accounts (10k+ followers), use a queue / batch approach.
export const onPostCreate = db
  .document('posts/{postId}')
  .onCreate(async (snap, context) => {
    const post = snap.data();
    const { postId } = context.params;
    const authorId: string = post.authorId;

    // Get all followers
    const followersSnap = await db
      .collection('follows')
      .where('followingId', '==', authorId)
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();

    followersSnap.docs.forEach((followerDoc) => {
      const followerId = followerDoc.data().followerId;
      const feedRef = db
        .collection('feed')
        .doc(followerId)
        .collection('items')
        .doc(postId);

      batch.set(feedRef, {
        postId,
        authorId,
        createdAt: post.createdAt,
        // score: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Also add to author's own feed
    batch.set(
      db.collection('feed').doc(authorId).collection('items').doc(postId),
      { postId, authorId, createdAt: post.createdAt }
    );

    await batch.commit();
    functions.logger.info(`Feed fan-out complete for post ${postId} to ${followersSnap.size} followers`);
  });

// ─────────────────────────────────────────────
// REMOVE FROM FEED ON POST DELETE
// ─────────────────────────────────────────────
export const onPostDelete = functions.firestore
  .document('posts/{postId}')
  .onDelete(async (snap, context) => {
    const { postId } = context.params;
    const authorId: string = snap.data().authorId;

    // Get all feed items for this post
    const feedItems = await db.collectionGroup('items')
      .where('postId', '==', postId)
      .get();

    const batch = db.batch();
    feedItems.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  });

// ─────────────────────────────────────────────
// NOTIFICATIONS: LIKE
// ─────────────────────────────────────────────
export const onLikeCreate = functions.firestore
  .document('posts/{postId}/likes/{userId}')
  .onCreate(async (snap, context) => {
    const { postId, userId: actorId } = context.params;

    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;

    const authorId: string = postSnap.data()!.authorId;
    if (authorId === actorId) return; // Don't notify self

    await db.collection('users').doc(authorId).collection('notifications').add({
      recipientId: authorId,
      actorId,
      type: 'like',
      postId,
      isRead: false,
      // createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// ─────────────────────────────────────────────
// NOTIFICATIONS: COMMENT
// ─────────────────────────────────────────────
export const onCommentCreate = functions.firestore
  .document('posts/{postId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const comment = snap.data();
    const { postId, commentId } = context.params;

    const postSnap = await db.doc(`posts/${postId}`).get();
    if (!postSnap.exists) return;

    const authorId: string = postSnap.data()!.authorId;
    if (authorId === comment.authorId) return;

    await db.collection('users').doc(authorId).collection('notifications').add({
      recipientId: authorId,
      actorId: comment.authorId,
      type: 'comment',
      postId,
      commentId,
      isRead: false,
      // createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// ─────────────────────────────────────────────
// NOTIFICATIONS: FOLLOW
// ─────────────────────────────────────────────
export const onFollowCreate = functions.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const follow = snap.data();

    await db
      .collection('users')
      .doc(follow.followingId)
      .collection('notifications')
      .add({
        recipientId: follow.followingId,
        actorId: follow.followerId,
        type: follow.status === 'pending' ? 'follow_request' : 'follow',
        isRead: false,
        // createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  });

// ─────────────────────────────────────────────
// CLEAN UP ON USER DELETE
// ─────────────────────────────────────────────
export const onUserDelete = functions.auth
  .user()
  .onDelete(async (user) => {
    const uid = user.uid;

    // This should ideally be done in batches/queue for large accounts
    // Using a Cloud Task or recursive delete extension is recommended for production
    await Promise.all([
      db.doc(`users/${uid}`).delete(),
      db.doc(`subscriptions/${uid}`).delete(),
      // Username cleanup handled separately
    ]);

    functions.logger.info(`Cleaned up data for deleted user ${uid}`);
  });

// ─────────────────────────────────────────────
// STORY EXPIRATION (runs every hour)
// ─────────────────────────────────────────────
export const cleanupExpiredStories = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    const expiredStories = await db
      .collectionGroup('stories')
      .where('expiresAt', '<=', now)
      .get();

    const batch = db.batch();
    expiredStories.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    functions.logger.info(`Deleted ${expiredStories.size} expired stories`);
  });

// ─────────────────────────────────────────────
// STRIPE WEBHOOK
// ─────────────────────────────────────────────
// Set webhook endpoint in Stripe Dashboard:
// https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhook
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = functions.config().stripe?.webhook_secret ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    functions.logger.error('Stripe webhook signature failed', err);
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const userSnap = await db
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (userSnap.empty) {
    functions.logger.warn(`No user found for Stripe customer ${customerId}`);
    res.sendStatus(200);
    return;
  }

  const uid = userSnap.docs[0].id;
  const tierMap: Record<string, string> = {
    // Map your Stripe Price IDs to app tiers
    [functions.config().stripe?.basic_monthly_price ?? 'price_basic_monthly']: 'basic',
    [functions.config().stripe?.pro_monthly_price ?? 'price_pro_monthly']: 'pro',
    [functions.config().stripe?.creator_monthly_price ?? 'price_creator_monthly']: 'creator',
    [functions.config().stripe?.basic_yearly_price ?? 'price_basic_yearly']: 'basic',
    [functions.config().stripe?.pro_yearly_price ?? 'price_pro_yearly']: 'pro',
    [functions.config().stripe?.creator_yearly_price ?? 'price_creator_yearly']: 'creator',
  };

  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const tier = tierMap[priceId] ?? 'free';

  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'none',
    incomplete_expired: 'none',
    paused: 'none',
  };

  const subData = {
    tier: event.type === 'customer.subscription.deleted' ? 'free' : tier,
    status: statusMap[subscription.status] ?? 'none',
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: admin.firestore.Timestamp.fromMillis(
      subscription.current_period_end * 1000
    ),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`subscriptions/${uid}`).set(subData, { merge: true });
  await db.doc(`users/${uid}`).update({
    subscriptionTier: subData.tier,
    subscriptionStatus: subData.status,
    subscriptionExpiresAt: subData.currentPeriodEnd,
  });

  functions.logger.info(`Updated subscription for user ${uid}:`, subData);
  res.sendStatus(200);
});

// ─────────────────────────────────────────────
// CREATE STRIPE CHECKOUT SESSION (callable)
// ─────────────────────────────────────────────
export const createStripeCheckoutSession = functions.https.onCall(
  async (data: { tier: string; billingPeriod: string }, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const uid = context.auth.uid;
    const userSnap = await db.doc(`users/${uid}`).get();
    const user = userSnap.data()!;

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { firebaseUID: uid },
      });
      customerId = customer.id;
      await db.doc(`users/${uid}`).update({ stripeCustomerId: customerId });
    }

    // Map tier + period to price ID (set these in Firebase config)
    const priceKey = `stripe.${data.tier}_${data.billingPeriod}_price`;
    const priceId = functions.config().stripe?.[`${data.tier}_${data.billingPeriod}_price`] ?? '';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: 'https://yourdomain.com/subscription/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://yourdomain.com/subscription/cancel',
    });

    return { url: session.url };
  }
);

// ─────────────────────────────────────────────
// REVENUECAT WEBHOOK (callable for mobile IAP)
// ─────────────────────────────────────────────
// Configure in RevenueCat: Project Settings → Integrations → Webhooks
// Set URL to: https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/revenueCatWebhook
export const revenueCatWebhook = functions.https.onRequest(async (req, res) => {
  // Verify RevenueCat authorization header
  const rcAuth = req.headers.authorization;
  const expectedAuth = functions.config().revenuecat?.webhook_auth ?? '';
  if (rcAuth !== expectedAuth) {
    res.status(401).send('Unauthorized');
    return;
  }

  const event = req.body;
  const uid: string = event.app_user_id; // We set Firebase UID as RevenueCat user ID

  const entitlements: string[] = Object.keys(event.subscriber?.entitlements ?? {});
  let tier = 'free';
  let status = 'none';

  if (entitlements.includes('creator')) { tier = 'creator'; status = 'active'; }
  else if (entitlements.includes('pro')) { tier = 'pro'; status = 'active'; }
  else if (entitlements.includes('basic')) { tier = 'basic'; status = 'active'; }

  // Handle event types
  if (['CANCELLATION', 'EXPIRATION'].includes(event.type)) {
    tier = 'free';
    status = event.type === 'CANCELLATION' ? 'canceled' : 'none';
  } else if (event.type === 'BILLING_ISSUE') {
    status = 'past_due';
  }

  await db.doc(`subscriptions/${uid}`).set({
    tier,
    status,
    revenueCatEvent: event.type,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.doc(`users/${uid}`).update({
    subscriptionTier: tier,
    subscriptionStatus: status,
  });

  functions.logger.info(`RevenueCat event ${event.type} for user ${uid}: tier=${tier}`);
  res.sendStatus(200);
});
