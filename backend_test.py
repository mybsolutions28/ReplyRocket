#!/usr/bin/env python3
"""
ReplyRocket Production Backend Test Suite
Tests multi-tenant auth, data isolation, AI reply, and Razorpay webhook integration
"""

import requests
import json
import hmac
import hashlib
import time
from datetime import datetime

BASE_URL = "https://funnel-ai-hub.preview.emergentagent.com/api"
WEBHOOK_SECRET = "5358076cf4c0879fe47aca1356010fb99569ad74d9dfc5a8"

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")

# ============================================================================
# TEST 1 — Auth + multi-tenant seeding
# ============================================================================
def test_auth_and_multitenant():
    print_test("Test 1 — Auth + Multi-tenant Seeding")
    
    try:
        # Create session A
        session_a = requests.Session()
        ts = int(time.time())
        email_a = f"alice_{ts}@test.io"
        
        print_info(f"Signing up user A: {email_a}")
        resp = session_a.post(f"{BASE_URL}/auth/signup", json={
            "email": email_a,
            "password": "pass1234",
            "name": "Alice",
            "business_name": "Alice Salon"
        }, timeout=10)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print_error(f"Signup A failed: {resp.status_code} - {resp.text}")
            return False
        
        data_a = resp.json()
        print(f"User A: {json.dumps(data_a, indent=2)}")
        
        # Verify response structure
        if not data_a.get('id'):
            print_error("Missing id in signup response")
            return False
        if data_a.get('email') != email_a:
            print_error(f"Email mismatch: {data_a.get('email')} != {email_a}")
            return False
        if data_a.get('business_name') != "Alice Salon":
            print_error(f"Business name mismatch: {data_a.get('business_name')}")
            return False
        if not data_a.get('workspace_id'):
            print_error("Missing workspace_id")
            return False
        
        workspace_a = data_a['workspace_id']
        print_success(f"User A created with workspace: {workspace_a}")
        
        # Verify cookie was set
        cookies_a = session_a.cookies.get_dict()
        if 'rr_token' not in cookies_a:
            print_error("JWT cookie 'rr_token' not set")
            return False
        print_success("JWT cookie 'rr_token' set")
        
        # Test /auth/me
        print_info("Testing GET /api/auth/me")
        resp = session_a.get(f"{BASE_URL}/auth/me", timeout=10)
        if resp.status_code != 200:
            print_error(f"/auth/me failed: {resp.status_code}")
            return False
        me_data = resp.json()
        if me_data.get('id') != data_a['id']:
            print_error(f"User ID mismatch in /auth/me")
            return False
        print_success("/auth/me returns correct user")
        
        # Verify seeded agent
        print_info("Checking seeded agent")
        resp = session_a.get(f"{BASE_URL}/agent", timeout=10)
        if resp.status_code != 200:
            print_error(f"GET /agent failed: {resp.status_code}")
            return False
        agent_a = resp.json()
        if agent_a.get('business_name') != "Alice Salon":
            print_error(f"Agent business_name mismatch: {agent_a.get('business_name')}")
            return False
        print_success(f"Agent seeded with business_name: {agent_a.get('business_name')}")
        
        # Verify seeded campaigns
        print_info("Checking seeded campaigns")
        resp = session_a.get(f"{BASE_URL}/campaigns", timeout=10)
        if resp.status_code != 200:
            print_error(f"GET /campaigns failed: {resp.status_code}")
            return False
        campaigns_a = resp.json()
        if len(campaigns_a) != 2:
            print_error(f"Expected 2 seeded campaigns, got {len(campaigns_a)}")
            return False
        
        keywords_a = [c.get('keyword') for c in campaigns_a]
        if 'PRICE' not in keywords_a or 'INFO' not in keywords_a:
            print_error(f"Expected PRICE and INFO campaigns, got: {keywords_a}")
            return False
        print_success(f"2 campaigns seeded with keywords: {keywords_a}")
        
        campaign_ids_a = [c['id'] for c in campaigns_a]
        
        # ---- Now signup user B ----
        session_b = requests.Session()
        email_b = f"bob_{ts}@test.io"
        
        print_info(f"\nSigning up user B: {email_b}")
        resp = session_b.post(f"{BASE_URL}/auth/signup", json={
            "email": email_b,
            "password": "pass5678",
            "name": "Bob",
            "business_name": "Bob Studio"
        }, timeout=10)
        
        if resp.status_code != 200:
            print_error(f"Signup B failed: {resp.status_code} - {resp.text}")
            return False
        
        data_b = resp.json()
        workspace_b = data_b['workspace_id']
        print_success(f"User B created with workspace: {workspace_b}")
        
        if workspace_a == workspace_b:
            print_error("User A and B have same workspace_id!")
            return False
        print_success("User A and B have different workspace_ids")
        
        # Verify B's campaigns
        print_info("Checking user B's campaigns")
        resp = session_b.get(f"{BASE_URL}/campaigns", timeout=10)
        if resp.status_code != 200:
            print_error(f"GET /campaigns for B failed: {resp.status_code}")
            return False
        campaigns_b = resp.json()
        if len(campaigns_b) != 2:
            print_error(f"Expected 2 seeded campaigns for B, got {len(campaigns_b)}")
            return False
        
        campaign_ids_b = [c['id'] for c in campaigns_b]
        
        # Verify B's campaign IDs differ from A's
        if any(cid in campaign_ids_a for cid in campaign_ids_b):
            print_error("User B can see user A's campaigns!")
            return False
        print_success("User B's campaigns are isolated from user A")
        
        # Test logout with B
        print_info("Testing logout with user B")
        resp = session_b.post(f"{BASE_URL}/auth/logout", timeout=10)
        if resp.status_code != 200:
            print_error(f"Logout failed: {resp.status_code}")
            return False
        print_success("Logout successful")
        
        # Verify /auth/me returns 401 after logout
        resp = session_b.get(f"{BASE_URL}/auth/me", timeout=10)
        if resp.status_code != 401:
            print_error(f"Expected 401 after logout, got {resp.status_code}")
            return False
        print_success("/auth/me returns 401 after logout")
        
        # Test login with B
        print_info("Testing login with user B")
        resp = session_b.post(f"{BASE_URL}/auth/login", json={
            "email": email_b,
            "password": "pass5678"
        }, timeout=10)
        if resp.status_code != 200:
            print_error(f"Login failed: {resp.status_code}")
            return False
        print_success("Login successful")
        
        # Test login with wrong password
        print_info("Testing login with wrong password")
        session_bad = requests.Session()
        resp = session_bad.post(f"{BASE_URL}/auth/login", json={
            "email": email_b,
            "password": "wrongpassword"
        }, timeout=10)
        if resp.status_code != 401:
            print_error(f"Expected 401 for wrong password, got {resp.status_code}")
            return False
        print_success("Login with wrong password returns 401")
        
        print_success("✅ TEST 1 PASSED — Auth + multi-tenant seeding working")
        return True, session_a, session_b, campaigns_a
        
    except Exception as e:
        print_error(f"Test 1 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None, None

# ============================================================================
# TEST 2 — Multi-tenant data isolation
# ============================================================================
def test_data_isolation(session_a, session_b):
    print_test("Test 2 — Multi-tenant Data Isolation")
    
    try:
        # Create campaign with user A
        print_info("Creating campaign BUYA with user A")
        resp = session_a.post(f"{BASE_URL}/campaigns", json={
            "keyword": "BUYA",
            "dm_template": "hi",
            "post_caption": "a"
        }, timeout=10)
        
        if resp.status_code != 200:
            print_error(f"Create campaign failed: {resp.status_code} - {resp.text}")
            return False
        
        campaign_a = resp.json()
        print_success(f"Campaign BUYA created: {campaign_a['id']}")
        
        # Verify user B cannot see BUYA campaign
        print_info("Checking if user B can see BUYA campaign")
        resp = session_b.get(f"{BASE_URL}/campaigns", timeout=10)
        if resp.status_code != 200:
            print_error(f"GET campaigns for B failed: {resp.status_code}")
            return False
        
        campaigns_b = resp.json()
        keywords_b = [c.get('keyword') for c in campaigns_b]
        
        if 'BUYA' in keywords_b:
            print_error("User B can see user A's BUYA campaign!")
            return False
        
        print_success("User B cannot see user A's BUYA campaign")
        print_success("✅ TEST 2 PASSED — Multi-tenant data isolation working")
        return True
        
    except Exception as e:
        print_error(f"Test 2 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 3 — Comment simulator + AI reply (real Razorpay link)
# ============================================================================
def test_comment_and_ai_reply(session_a, campaigns_a):
    print_test("Test 3 — Comment Simulator + AI Reply (Real Razorpay Link)")
    
    try:
        # Find PRICE campaign
        price_campaign = None
        for c in campaigns_a:
            if c.get('keyword') == 'PRICE':
                price_campaign = c
                break
        
        if not price_campaign:
            print_error("PRICE campaign not found")
            return False, None, None
        
        print_info(f"Using PRICE campaign: {price_campaign['id']}")
        
        # Simulate comment
        print_info("Simulating comment with keyword PRICE")
        resp = session_a.post(f"{BASE_URL}/simulate-comment", json={
            "campaign_id": price_campaign['id'],
            "commenter_handle": "@buyer",
            "comment_text": "PRICE"
        }, timeout=10)
        
        if resp.status_code != 200:
            print_error(f"Simulate comment failed: {resp.status_code} - {resp.text}")
            return False, None, None
        
        sim_data = resp.json()
        print(f"Simulate response: {json.dumps(sim_data, indent=2)}")
        
        if not sim_data.get('matched'):
            print_error("Comment did not match")
            return False, None, None
        
        conversation_id = sim_data.get('conversation_id')
        lead_id = sim_data.get('lead_id')
        
        if not conversation_id or not lead_id:
            print_error("Missing conversation_id or lead_id")
            return False, None, None
        
        print_success(f"Comment matched, conversation: {conversation_id}, lead: {lead_id}")
        
        # Send AI reply requesting payment link
        print_info("Sending AI reply: 'I want to buy the Sample Service for 999. Send me payment link please'")
        resp = session_a.post(f"{BASE_URL}/conversations/{conversation_id}/reply", json={
            "text": "I want to buy the Sample Service for 999. Send me payment link please"
        }, timeout=30)
        
        if resp.status_code != 200:
            print_error(f"AI reply failed: {resp.status_code} - {resp.text}")
            return False, None, None
        
        reply_data = resp.json()
        print(f"AI reply: {json.dumps(reply_data, indent=2)}")
        
        ai_meta = reply_data.get('ai_meta', {})
        actions = ai_meta.get('actions', [])
        
        # Look for share_payment_link action
        payment_action = None
        for action in actions:
            if action.get('type') == 'share_payment_link':
                payment_action = action
                break
        
        if not payment_action:
            print_error("No share_payment_link action found in AI response")
            print_info(f"Actions: {actions}")
            return False, None, None
        
        print_success(f"Payment link action found: {json.dumps(payment_action, indent=2)}")
        
        # Verify link structure
        link = payment_action.get('link')
        if not link:
            print_error("Payment action missing 'link' object")
            return False, None, None
        
        short_url = link.get('short_url')
        if not short_url:
            print_error("Payment link missing 'short_url'")
            return False, None, None
        
        if not short_url.startswith('https://rzp.io/'):
            print_error(f"Invalid Razorpay short_url: {short_url}")
            return False, None, None
        
        print_success(f"✅ Real Razorpay link generated: {short_url}")
        
        # Verify amount and label
        if not link.get('amount'):
            print_error("Payment link missing 'amount'")
            return False, None, None
        
        if not link.get('label'):
            print_error("Payment link missing 'label'")
            return False, None, None
        
        print_success(f"Amount: ₹{link.get('amount')}, Label: {link.get('label')}")
        
        # Verify messages contain the payment link
        print_info("Verifying messages contain payment link")
        resp = session_a.get(f"{BASE_URL}/conversations/{conversation_id}/messages", timeout=10)
        if resp.status_code != 200:
            print_error(f"Get messages failed: {resp.status_code}")
            return False, None, None
        
        msg_data = resp.json()
        messages = msg_data.get('messages', [])
        
        # Find agent message with payment action
        found_payment_msg = False
        for msg in messages:
            if msg.get('role') == 'agent' and msg.get('meta', {}).get('actions'):
                for action in msg['meta']['actions']:
                    if action.get('type') == 'share_payment_link' and action.get('link', {}).get('short_url'):
                        found_payment_msg = True
                        break
        
        if not found_payment_msg:
            print_error("Payment link not found in messages")
            return False, None, None
        
        print_success("Payment link found in conversation messages")
        
        # Verify lead is NOT converted yet (only webhook should convert)
        print_info("Verifying lead is NOT converted (AI should not auto-convert)")
        resp = session_a.get(f"{BASE_URL}/leads", timeout=10)
        if resp.status_code != 200:
            print_error(f"Get leads failed: {resp.status_code}")
            return False, None, None
        
        leads = resp.json()
        lead = None
        for l in leads:
            if l.get('id') == lead_id:
                lead = l
                break
        
        if not lead:
            print_error("Lead not found")
            return False, None, None
        
        if lead.get('stage') == 'converted':
            print_error("Lead is already converted (should only convert via webhook)")
            return False, None, None
        
        valid_stages = ['new', 'interested', 'qualified', 'negotiation', 'lost']
        if lead.get('stage') not in valid_stages:
            print_error(f"Invalid lead stage: {lead.get('stage')}")
            return False, None, None
        
        print_success(f"Lead stage is '{lead.get('stage')}' (not converted yet)")
        print_success("✅ TEST 3 PASSED — Comment simulator + AI reply with real Razorpay link working")
        return True, conversation_id, lead_id
        
    except Exception as e:
        print_error(f"Test 3 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, None, None

# ============================================================================
# TEST 4 — Razorpay webhook auto-conversion
# ============================================================================
def test_razorpay_webhook(session_a, conversation_id, lead_id):
    print_test("Test 4 — Razorpay Webhook Auto-Conversion")
    
    try:
        # Build webhook payload
        print_info("Building Razorpay webhook payload")
        payload = {
            "event": "payment_link.paid",
            "payload": {
                "payment_link": {
                    "entity": {
                        "id": "plink_TEST",
                        "reference_id": f"convo_{conversation_id}",
                        "amount": 99900,
                        "amount_paid": 99900,
                        "currency": "INR"
                    }
                },
                "payment": {
                    "entity": {
                        "id": "pay_TEST"
                    }
                }
            }
        }
        
        body = json.dumps(payload).encode()
        sig = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        
        print_info(f"Signature: {sig}")
        
        # Send webhook with valid signature
        print_info("Sending webhook with valid signature")
        resp = requests.post(f"{BASE_URL}/webhooks/razorpay", 
            data=body,
            headers={
                'x-razorpay-signature': sig,
                'x-razorpay-event-id': 'evt_1',
                'Content-Type': 'application/json'
            },
            timeout=10
        )
        
        if resp.status_code != 200:
            print_error(f"Webhook failed: {resp.status_code} - {resp.text}")
            return False
        
        webhook_resp = resp.json()
        print(f"Webhook response: {json.dumps(webhook_resp, indent=2)}")
        
        if not webhook_resp.get('ok'):
            print_error("Webhook did not return ok:true")
            return False
        
        print_success("Webhook accepted")
        
        # Verify lead is now converted
        print_info("Verifying lead is converted")
        resp = session_a.get(f"{BASE_URL}/leads", timeout=10)
        if resp.status_code != 200:
            print_error(f"Get leads failed: {resp.status_code}")
            return False
        
        leads = resp.json()
        lead = None
        for l in leads:
            if l.get('id') == lead_id:
                lead = l
                break
        
        if not lead:
            print_error("Lead not found")
            return False
        
        if lead.get('stage') != 'converted':
            print_error(f"Lead stage is '{lead.get('stage')}', expected 'converted'")
            return False
        
        if lead.get('score') != 'hot':
            print_error(f"Lead score is '{lead.get('score')}', expected 'hot'")
            return False
        
        if lead.get('revenue') != 999:
            print_error(f"Lead revenue is {lead.get('revenue')}, expected 999")
            return False
        
        print_success(f"Lead converted: stage={lead.get('stage')}, score={lead.get('score')}, revenue=₹{lead.get('revenue')}")
        
        # Verify system message in conversation
        print_info("Verifying system message in conversation")
        resp = session_a.get(f"{BASE_URL}/conversations/{conversation_id}/messages", timeout=10)
        if resp.status_code != 200:
            print_error(f"Get messages failed: {resp.status_code}")
            return False
        
        msg_data = resp.json()
        messages = msg_data.get('messages', [])
        
        system_msg = None
        for msg in messages:
            if msg.get('role') == 'system' and '💰 Payment received' in msg.get('text', ''):
                system_msg = msg
                break
        
        if not system_msg:
            print_error("System message '💰 Payment received' not found")
            return False
        
        print_success(f"System message found: {system_msg.get('text')}")
        
        # Test idempotency - send same webhook again
        print_info("Testing idempotency - sending same webhook again")
        resp = requests.post(f"{BASE_URL}/webhooks/razorpay", 
            data=body,
            headers={
                'x-razorpay-signature': sig,
                'x-razorpay-event-id': 'evt_1',
                'Content-Type': 'application/json'
            },
            timeout=10
        )
        
        if resp.status_code != 200:
            print_error(f"Idempotent webhook failed: {resp.status_code}")
            return False
        
        webhook_resp2 = resp.json()
        if not webhook_resp2.get('dedup'):
            print_error("Expected dedup:true for duplicate webhook")
            return False
        
        print_success("Idempotency working - duplicate webhook deduplicated")
        
        # Test invalid signature
        print_info("Testing invalid signature")
        resp = requests.post(f"{BASE_URL}/webhooks/razorpay", 
            data=body,
            headers={
                'x-razorpay-signature': 'deadbeef',
                'x-razorpay-event-id': 'evt_2',
                'Content-Type': 'application/json'
            },
            timeout=10
        )
        
        if resp.status_code != 401:
            print_error(f"Expected 401 for invalid signature, got {resp.status_code}")
            return False
        
        error_resp = resp.json()
        if error_resp.get('error') != 'invalid_signature':
            print_error(f"Expected error='invalid_signature', got {error_resp.get('error')}")
            return False
        
        print_success("Invalid signature rejected with 401")
        print_success("✅ TEST 4 PASSED — Razorpay webhook auto-conversion working")
        return True
        
    except Exception as e:
        print_error(f"Test 4 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 5 — Anonymous access denied
# ============================================================================
def test_anonymous_access():
    print_test("Test 5 — Anonymous Access Denied")
    
    try:
        endpoints = [
            '/agent',
            '/campaigns',
            '/conversations',
            '/leads',
            '/analytics'
        ]
        
        for endpoint in endpoints:
            print_info(f"Testing {endpoint} without auth")
            resp = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            if resp.status_code != 401:
                print_error(f"Expected 401 for {endpoint}, got {resp.status_code}")
                return False
            print_success(f"{endpoint} returns 401")
        
        # Test simulate-comment without auth
        print_info("Testing POST /simulate-comment without auth")
        resp = requests.post(f"{BASE_URL}/simulate-comment", json={
            "campaign_id": "test",
            "commenter_handle": "@test",
            "comment_text": "test"
        }, timeout=10)
        if resp.status_code != 401:
            print_error(f"Expected 401 for /simulate-comment, got {resp.status_code}")
            return False
        print_success("/simulate-comment returns 401")
        
        print_success("✅ TEST 5 PASSED — Anonymous access properly denied")
        return True
        
    except Exception as e:
        print_error(f"Test 5 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# TEST 6 — Edge cases
# ============================================================================
def test_edge_cases(session_a):
    print_test("Test 6 — Edge Cases")
    
    try:
        # Test signup with existing email
        print_info("Testing signup with existing email")
        resp = session_a.post(f"{BASE_URL}/auth/signup", json={
            "email": session_a.cookies.get('test_email', 'alice_test@test.io'),
            "password": "pass1234",
            "name": "Alice Duplicate"
        }, timeout=10)
        
        # Note: session_a already has a user, so we need to use the email from earlier
        # Let's just test with a known pattern
        ts = int(time.time())
        email_dup = f"duplicate_{ts}@test.io"
        
        # First create the user
        session_dup = requests.Session()
        resp = session_dup.post(f"{BASE_URL}/auth/signup", json={
            "email": email_dup,
            "password": "pass1234",
            "name": "First"
        }, timeout=10)
        
        if resp.status_code != 200:
            print_error(f"Initial signup failed: {resp.status_code}")
            return False
        
        # Now try to signup again with same email
        session_dup2 = requests.Session()
        resp = session_dup2.post(f"{BASE_URL}/auth/signup", json={
            "email": email_dup,
            "password": "pass1234",
            "name": "Duplicate"
        }, timeout=10)
        
        if resp.status_code != 409:
            print_error(f"Expected 409 for duplicate email, got {resp.status_code}")
            return False
        
        error_data = resp.json()
        if error_data.get('error') != 'email_taken':
            print_error(f"Expected error='email_taken', got {error_data.get('error')}")
            return False
        
        print_success("Duplicate email returns 409 with error='email_taken'")
        
        # Test invalid conversation ID
        print_info("Testing POST /conversations/INVALID/reply")
        resp = session_a.post(f"{BASE_URL}/conversations/INVALID/reply", json={
            "text": "test"
        }, timeout=10)
        
        if resp.status_code != 404:
            print_error(f"Expected 404 for invalid conversation, got {resp.status_code}")
            return False
        
        print_success("Invalid conversation ID returns 404")
        
        # Test simulate-comment with invalid campaign_id
        print_info("Testing POST /simulate-comment with invalid campaign_id")
        resp = session_a.post(f"{BASE_URL}/simulate-comment", json={
            "campaign_id": "nonexistent-campaign-id",
            "commenter_handle": "@test",
            "comment_text": "test"
        }, timeout=10)
        
        if resp.status_code != 404:
            print_error(f"Expected 404 for invalid campaign, got {resp.status_code}")
            return False
        
        print_success("Invalid campaign ID returns 404")
        
        print_success("✅ TEST 6 PASSED — Edge cases handled correctly")
        return True
        
    except Exception as e:
        print_error(f"Test 6 failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("REPLYROCKET PRODUCTION BACKEND TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing multi-tenant auth, data isolation, AI reply, and Razorpay webhook")
    print("="*80)
    
    results = {}
    
    # Test 1: Auth + multi-tenant
    result = test_auth_and_multitenant()
    if isinstance(result, tuple):
        success, session_a, session_b, campaigns_a = result
        results['Test 1: Auth + Multi-tenant'] = success
    else:
        results['Test 1: Auth + Multi-tenant'] = False
        session_a = session_b = campaigns_a = None
    
    if not results['Test 1: Auth + Multi-tenant']:
        print_error("Test 1 failed, cannot continue")
        print_summary(results)
        return False
    
    # Test 2: Data isolation
    results['Test 2: Data Isolation'] = test_data_isolation(session_a, session_b)
    
    # Test 3: Comment + AI reply
    result = test_comment_and_ai_reply(session_a, campaigns_a)
    if isinstance(result, tuple):
        success, conversation_id, lead_id = result
        results['Test 3: Comment + AI Reply'] = success
    else:
        results['Test 3: Comment + AI Reply'] = False
        conversation_id = lead_id = None
    
    # Test 4: Razorpay webhook
    if conversation_id and lead_id:
        results['Test 4: Razorpay Webhook'] = test_razorpay_webhook(session_a, conversation_id, lead_id)
    else:
        print_error("Skipping Test 4 - no conversation/lead from Test 3")
        results['Test 4: Razorpay Webhook'] = False
    
    # Test 5: Anonymous access
    results['Test 5: Anonymous Access'] = test_anonymous_access()
    
    # Test 6: Edge cases
    results['Test 6: Edge Cases'] = test_edge_cases(session_a)
    
    # Summary
    print_summary(results)
    
    return all(results.values())

def print_summary(results):
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
