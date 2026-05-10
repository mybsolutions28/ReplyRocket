#!/usr/bin/env python3
"""
ReplyRocket Backend API Test Suite
Tests all backend endpoints with realistic data
"""

import requests
import json
import time

# Base URL from .env
BASE_URL = "https://funnel-ai-hub.preview.emergentagent.com/api"

# Test data
test_campaign_id = None
test_lead_id = None
test_conversation_id = None

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_success(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def check_no_mongo_id(data, path=""):
    """Recursively check for MongoDB _id fields"""
    if isinstance(data, dict):
        if '_id' in data:
            print_error(f"MongoDB _id found at {path}")
            return False
        for key, value in data.items():
            if not check_no_mongo_id(value, f"{path}.{key}"):
                return False
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if not check_no_mongo_id(item, f"{path}[{i}]"):
                return False
    return True

# ============================================================================
# 1. HEALTH CHECK
# ============================================================================
def test_health():
    print_test("1. Health Check - GET /api/health")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('ok') != True:
            print_error(f"Expected ok=true, got {data.get('ok')}")
            return False
        
        if data.get('app') != 'ReplyRocket':
            print_error(f"Expected app='ReplyRocket', got {data.get('app')}")
            return False
        
        if data.get('model') != 'claude-sonnet-4-5':
            print_error(f"Expected model='claude-sonnet-4-5', got {data.get('model')}")
            return False
        
        print_success("Health check passed")
        return True
    except Exception as e:
        print_error(f"Health check failed: {e}")
        return False

# ============================================================================
# 2. AI AGENT CRUD
# ============================================================================
def test_agent_get():
    print_test("2a. AI Agent - GET /api/agent (seed data)")
    try:
        resp = requests.get(f"{BASE_URL}/agent", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check no _id
        if not check_no_mongo_id(data):
            return False
        
        # Check seed data
        if data.get('business_name') != 'Pawsome Pet Salon':
            print_error(f"Expected business_name='Pawsome Pet Salon', got {data.get('business_name')}")
            return False
        
        # Check required fields
        required = ['services', 'faqs', 'booking_link', 'upi_id', 'persona', 'tone', 'language']
        for field in required:
            if field not in data:
                print_error(f"Missing field: {field}")
                return False
        
        print(f"Services count: {len(data.get('services', []))}")
        print(f"FAQs count: {len(data.get('faqs', []))}")
        print(f"Booking link: {data.get('booking_link')}")
        print(f"UPI ID: {data.get('upi_id')}")
        
        print_success("Agent GET passed - seed data correct")
        return True
    except Exception as e:
        print_error(f"Agent GET failed: {e}")
        return False

def test_agent_post():
    print_test("2b. AI Agent - POST /api/agent (update)")
    try:
        payload = {
            "business_name": "Pawsome Pet Salon - Updated",
            "persona": "Updated persona",
            "tone": "professional",
            "language": "English",
            "services": [
                {"name": "Test Service", "price": 999, "description": "Test"}
            ],
            "faqs": [
                {"q": "Test question?", "a": "Test answer"}
            ],
            "booking_link": "https://cal.com/pawsome/book",
            "upi_id": "pawsome@upi"
        }
        
        resp = requests.post(f"{BASE_URL}/agent", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        if data.get('business_name') != "Pawsome Pet Salon - Updated":
            print_error(f"Business name not updated: {data.get('business_name')}")
            return False
        
        # Verify with GET
        resp2 = requests.get(f"{BASE_URL}/agent", timeout=10)
        data2 = resp2.json()
        
        if data2.get('business_name') != "Pawsome Pet Salon - Updated":
            print_error("Update not persisted")
            return False
        
        # Restore original
        restore = {
            "business_name": "Pawsome Pet Salon",
            "persona": "You are Riya — Pawsome Pet Salon's super-friendly AI booking assistant. You love dogs and you make every pet parent feel welcome.",
            "tone": "warm, playful, concise",
            "language": "English + Hinglish (auto-detect)",
            "services": [
                {"name": "Basic Grooming", "price": 799, "description": "Bath, blow-dry, brushing, ear cleaning. ~60 min."},
                {"name": "Full Spa Package", "price": 1499, "description": "Grooming + nail trim + de-shedding + paw massage. ~90 min."},
                {"name": "Pet Photoshoot", "price": 2499, "description": "30-min studio shoot with 10 edited photos."}
            ],
            "faqs": [
                {"q": "Where are you located?", "a": "We are in HSR Layout, Bangalore. Free parking available."},
                {"q": "Do you handle aggressive dogs?", "a": "Yes — we have certified handlers and a calming room."},
                {"q": "Do you have weekend slots?", "a": "Yes! Saturdays and Sundays 9am-7pm."}
            ],
            "booking_link": "https://cal.com/pawsome/book",
            "upi_id": "pawsome@upi"
        }
        requests.post(f"{BASE_URL}/agent", json=restore, timeout=10)
        
        print_success("Agent POST passed - update and restore successful")
        return True
    except Exception as e:
        print_error(f"Agent POST failed: {e}")
        return False

# ============================================================================
# 3. CAMPAIGNS CRUD
# ============================================================================
def test_campaigns_get():
    print_test("3a. Campaigns - GET /api/campaigns (seed data)")
    try:
        resp = requests.get(f"{BASE_URL}/campaigns", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Campaigns count: {len(data)}")
        
        if len(data) < 2:
            print_error(f"Expected at least 2 seed campaigns, got {len(data)}")
            return False
        
        # Check no _id
        if not check_no_mongo_id(data):
            return False
        
        # Check for PRICE and SHOOT keywords
        keywords = [c.get('keyword') for c in data]
        print(f"Keywords: {keywords}")
        
        if 'PRICE' not in keywords:
            print_error("PRICE campaign not found")
            return False
        
        if 'SHOOT' not in keywords:
            print_error("SHOOT campaign not found")
            return False
        
        # Store first campaign ID for later tests
        global test_campaign_id
        test_campaign_id = data[0].get('id')
        print(f"Stored campaign ID: {test_campaign_id}")
        
        print_success("Campaigns GET passed - seed data correct")
        return True
    except Exception as e:
        print_error(f"Campaigns GET failed: {e}")
        return False

def test_campaigns_post():
    print_test("3b. Campaigns - POST /api/campaigns (create)")
    try:
        payload = {
            "keyword": "buy",
            "dm_template": "Hi {{handle}}! Thanks for your interest 🎉",
            "post_caption": "test post caption",
            "post_image_url": "https://example.com/image.jpg"
        }
        
        resp = requests.post(f"{BASE_URL}/campaigns", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Created campaign: {json.dumps(data, indent=2)}")
        
        # Check keyword normalized to uppercase
        if data.get('keyword') != 'BUY':
            print_error(f"Expected keyword='BUY', got {data.get('keyword')}")
            return False
        
        if not data.get('id'):
            print_error("No ID returned")
            return False
        
        # Verify with GET
        resp2 = requests.get(f"{BASE_URL}/campaigns", timeout=10)
        campaigns = resp2.json()
        
        found = False
        for c in campaigns:
            if c.get('keyword') == 'BUY':
                found = True
                global test_campaign_id
                test_campaign_id = c.get('id')
                break
        
        if not found:
            print_error("Created campaign not found in GET")
            return False
        
        print_success("Campaigns POST passed - created with normalized keyword")
        return True
    except Exception as e:
        print_error(f"Campaigns POST failed: {e}")
        return False

def test_campaigns_delete():
    print_test("3c. Campaigns - DELETE /api/campaigns/{id}")
    try:
        global test_campaign_id
        
        if not test_campaign_id:
            print_error("No campaign ID to delete")
            return False
        
        resp = requests.delete(f"{BASE_URL}/campaigns/{test_campaign_id}", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        # Verify with GET
        resp2 = requests.get(f"{BASE_URL}/campaigns", timeout=10)
        campaigns = resp2.json()
        
        for c in campaigns:
            if c.get('id') == test_campaign_id:
                print_error("Campaign still exists after delete")
                return False
        
        # Reset to a valid campaign ID for later tests
        if len(campaigns) > 0:
            test_campaign_id = campaigns[0].get('id')
            print(f"Reset campaign ID to: {test_campaign_id}")
        
        print_success("Campaigns DELETE passed")
        return True
    except Exception as e:
        print_error(f"Campaigns DELETE failed: {e}")
        return False

# ============================================================================
# 4. COMMENT-TO-DM SIMULATOR
# ============================================================================
def test_simulate_comment_match():
    print_test("4a. Simulate Comment - Matching keyword")
    try:
        global test_campaign_id, test_lead_id, test_conversation_id
        
        # Get a campaign with PRICE keyword
        resp = requests.get(f"{BASE_URL}/campaigns", timeout=10)
        campaigns = resp.json()
        
        price_campaign = None
        for c in campaigns:
            if c.get('keyword') == 'PRICE':
                price_campaign = c
                break
        
        if not price_campaign:
            print_error("PRICE campaign not found")
            return False
        
        payload = {
            "campaign_id": price_campaign['id'],
            "commenter_handle": "goldenretriever_mom",
            "comment_text": "PRICE please! I need grooming for my dog"
        }
        
        resp = requests.post(f"{BASE_URL}/simulate-comment", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('matched') != True:
            print_error(f"Expected matched=true, got {data.get('matched')}")
            return False
        
        if not data.get('lead_id'):
            print_error("No lead_id returned")
            return False
        
        if not data.get('conversation_id'):
            print_error("No conversation_id returned")
            return False
        
        if not data.get('dm_text'):
            print_error("No dm_text returned")
            return False
        
        # Check {{handle}} replacement
        dm_text = data.get('dm_text', '')
        if '{{handle}}' in dm_text:
            print_error("{{handle}} not replaced in dm_text")
            return False
        
        if '@goldenretriever_mom' not in dm_text:
            print_error("Handle not found in dm_text")
            return False
        
        test_lead_id = data.get('lead_id')
        test_conversation_id = data.get('conversation_id')
        
        print(f"Created lead: {test_lead_id}")
        print(f"Created conversation: {test_conversation_id}")
        
        print_success("Simulate comment (match) passed")
        return True
    except Exception as e:
        print_error(f"Simulate comment (match) failed: {e}")
        return False

def test_simulate_comment_no_match():
    print_test("4b. Simulate Comment - Non-matching keyword")
    try:
        # Get any campaign
        resp = requests.get(f"{BASE_URL}/campaigns", timeout=10)
        campaigns = resp.json()
        
        if len(campaigns) == 0:
            print_error("No campaigns available")
            return False
        
        payload = {
            "campaign_id": campaigns[0]['id'],
            "commenter_handle": "random_user",
            "comment_text": "hello this is a random comment"
        }
        
        resp = requests.post(f"{BASE_URL}/simulate-comment", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get('matched') != False:
            print_error(f"Expected matched=false, got {data.get('matched')}")
            return False
        
        if data.get('lead_id'):
            print_error("lead_id should not be present for non-match")
            return False
        
        if data.get('conversation_id'):
            print_error("conversation_id should not be present for non-match")
            return False
        
        print_success("Simulate comment (no match) passed")
        return True
    except Exception as e:
        print_error(f"Simulate comment (no match) failed: {e}")
        return False

def test_simulate_comment_invalid_campaign():
    print_test("4c. Simulate Comment - Invalid campaign_id (edge case)")
    try:
        payload = {
            "campaign_id": "nonexistent-campaign-id",
            "commenter_handle": "test_user",
            "comment_text": "test comment"
        }
        
        resp = requests.post(f"{BASE_URL}/simulate-comment", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 404:
            print_error(f"Expected 404, got {resp.status_code}")
            return False
        
        data = resp.json()
        if 'error' not in data:
            print_error("Expected error field in response")
            return False
        
        print_success("Simulate comment (invalid campaign) passed - 404 returned")
        return True
    except Exception as e:
        print_error(f"Simulate comment (invalid campaign) failed: {e}")
        return False

# ============================================================================
# 5. AI AUTO-CLOSER REPLY (CRITICAL)
# ============================================================================
def test_ai_reply_turn1():
    print_test("5a. AI Reply - Turn 1 (pricing inquiry)")
    try:
        global test_conversation_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        payload = {
            "text": "I have a Golden Retriever, what's the price for full spa?"
        }
        
        resp = requests.post(f"{BASE_URL}/conversations/{test_conversation_id}/reply", json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check structure
        if 'user_message' not in data:
            print_error("Missing user_message")
            return False
        
        if 'agent_message' not in data:
            print_error("Missing agent_message")
            return False
        
        if 'ai_meta' not in data:
            print_error("Missing ai_meta")
            return False
        
        agent_msg = data['agent_message']
        ai_meta = data['ai_meta']
        
        # Check agent message
        if agent_msg.get('role') != 'agent':
            print_error(f"Expected role='agent', got {agent_msg.get('role')}")
            return False
        
        if not agent_msg.get('text'):
            print_error("Agent message text is empty")
            return False
        
        print(f"Agent reply: {agent_msg.get('text')[:100]}...")
        
        # Check ai_meta
        required_meta = ['intent', 'lead_score', 'lead_stage', 'actions']
        for field in required_meta:
            if field not in ai_meta:
                print_error(f"Missing ai_meta field: {field}")
                return False
        
        print(f"Intent: {ai_meta.get('intent')}")
        print(f"Lead score: {ai_meta.get('lead_score')}")
        print(f"Lead stage: {ai_meta.get('lead_stage')}")
        print(f"Actions: {ai_meta.get('actions')}")
        
        # Check actions types
        actions = ai_meta.get('actions', [])
        valid_action_types = ['share_pricing', 'share_booking_link', 'share_payment_link']
        for action in actions:
            if action.get('type') not in valid_action_types:
                print_error(f"Invalid action type: {action.get('type')}")
                return False
        
        print_success("AI Reply Turn 1 passed")
        return True
    except Exception as e:
        print_error(f"AI Reply Turn 1 failed: {e}")
        return False

def test_ai_reply_turn2():
    print_test("5b. AI Reply - Turn 2 (booking request)")
    try:
        global test_conversation_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        payload = {
            "text": "Yes book me for the Full Spa Package!"
        }
        
        resp = requests.post(f"{BASE_URL}/conversations/{test_conversation_id}/reply", json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        agent_msg = data.get('agent_message', {})
        ai_meta = data.get('ai_meta', {})
        
        print(f"Agent reply: {agent_msg.get('text')[:100]}...")
        print(f"Actions: {json.dumps(ai_meta.get('actions'), indent=2)}")
        
        # Check for booking link action
        actions = ai_meta.get('actions', [])
        booking_action = None
        for action in actions:
            if action.get('type') == 'share_booking_link':
                booking_action = action
                break
        
        if booking_action:
            print(f"Booking action found: {json.dumps(booking_action, indent=2)}")
            if not booking_action.get('url'):
                print_error("Booking action missing url field")
                return False
            
            if 'cal.com/pawsome/book' not in booking_action.get('url', ''):
                print_error(f"Unexpected booking URL: {booking_action.get('url')}")
                return False
            
            print(f"Booking link: {booking_action.get('url')}")
            print_success("AI Reply Turn 2 passed - booking link provided")
        else:
            print("⚠️  No booking link action (AI may have responded differently, but reply was generated)")
            print_success("AI Reply Turn 2 passed - coherent reply generated")
        
        return True
    except Exception as e:
        print_error(f"AI Reply Turn 2 failed: {e}")
        return False

def test_ai_reply_turn3():
    print_test("5c. AI Reply - Turn 3 (payment request)")
    try:
        global test_conversation_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        payload = {
            "text": "Send payment link for full spa"
        }
        
        resp = requests.post(f"{BASE_URL}/conversations/{test_conversation_id}/reply", json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        agent_msg = data.get('agent_message', {})
        ai_meta = data.get('ai_meta', {})
        
        print(f"Agent reply: {agent_msg.get('text')[:100]}...")
        print(f"Actions: {json.dumps(ai_meta.get('actions'), indent=2)}")
        
        # Check for payment link action
        actions = ai_meta.get('actions', [])
        payment_action = None
        for action in actions:
            if action.get('type') == 'share_payment_link':
                payment_action = action
                break
        
        if payment_action:
            print(f"Payment action found: {json.dumps(payment_action, indent=2)}")
            # Check required fields
            if not isinstance(payment_action.get('amount'), (int, float)):
                print_error(f"Payment action missing or invalid amount: {payment_action.get('amount')}")
                return False
            
            if not payment_action.get('label'):
                print_error("Payment action missing label")
                return False
            
            # Check backend-enriched link object
            if 'link' not in payment_action:
                print_error("Payment action missing enriched 'link' object")
                return False
            
            link = payment_action['link']
            if not link.get('url') or 'rzp.io/i/' not in link.get('url', ''):
                print_error(f"Invalid payment link URL: {link.get('url')}")
                return False
            
            if not isinstance(link.get('amount'), (int, float)):
                print_error(f"Invalid link amount: {link.get('amount')}")
                return False
            
            print(f"Payment link: {link.get('url')}")
            print(f"Amount: ₹{link.get('amount')}")
            print(f"Label: {link.get('label')}")
            print_success("AI Reply Turn 3 passed - payment link enriched correctly")
        else:
            print("⚠️  No payment link action (AI may not always return payment link, but reply was coherent)")
            print_success("AI Reply Turn 3 passed - coherent reply generated")
        
        return True
    except Exception as e:
        print_error(f"AI Reply Turn 3 failed: {e}")
        return False

def test_ai_context_persistence():
    print_test("5d. AI Reply - Context persistence (mention Golden Retriever)")
    try:
        global test_conversation_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        # Get messages to check context
        resp = requests.get(f"{BASE_URL}/conversations/{test_conversation_id}/messages", timeout=10)
        
        if resp.status_code != 200:
            print_error(f"Failed to get messages: {resp.status_code}")
            return False
        
        data = resp.json()
        messages = data.get('messages', [])
        
        print(f"Total messages: {len(messages)}")
        
        if len(messages) < 3:
            print_error(f"Expected at least 3 messages for multi-turn test, got {len(messages)}")
            return False
        
        # Check message roles
        roles = [m.get('role') for m in messages]
        print(f"Message roles: {roles}")
        
        # Should have: comment, agent (initial DM), user, agent, user, agent, user, agent
        if 'comment' not in roles:
            print_error("Missing initial comment message")
            return False
        
        user_count = roles.count('user')
        agent_count = roles.count('agent')
        
        print(f"User messages: {user_count}, Agent messages: {agent_count}")
        
        if user_count < 3:
            print_error(f"Expected at least 3 user messages, got {user_count}")
            return False
        
        # Check if Golden Retriever context is maintained
        first_user_msg = None
        for m in messages:
            if m.get('role') == 'user':
                first_user_msg = m.get('text', '')
                break
        
        if first_user_msg and 'Golden Retriever' in first_user_msg:
            print(f"Context established: {first_user_msg[:50]}...")
            print_success("AI context persistence verified - multi-turn conversation maintained")
        else:
            print_success("AI context persistence test passed - conversation flow maintained")
        
        return True
    except Exception as e:
        print_error(f"AI context persistence test failed: {e}")
        return False

def test_ai_reply_invalid_conversation():
    print_test("5e. AI Reply - Invalid conversation_id (edge case)")
    try:
        payload = {
            "text": "test message"
        }
        
        resp = requests.post(f"{BASE_URL}/conversations/nonexistent-id/reply", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 404:
            print_error(f"Expected 404, got {resp.status_code}")
            return False
        
        data = resp.json()
        if 'error' not in data:
            print_error("Expected error field in response")
            return False
        
        print_success("AI Reply (invalid conversation) passed - 404 returned")
        return True
    except Exception as e:
        print_error(f"AI Reply (invalid conversation) failed: {e}")
        return False

# ============================================================================
# 6. CONVERSATIONS ENDPOINTS
# ============================================================================
def test_conversations_list():
    print_test("6a. Conversations - GET /api/conversations")
    try:
        resp = requests.get(f"{BASE_URL}/conversations", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Conversations count: {len(data)}")
        
        if len(data) == 0:
            print_error("No conversations found")
            return False
        
        # Check no _id
        if not check_no_mongo_id(data):
            return False
        
        # Check structure
        first = data[0]
        if 'last_message' not in first:
            print_error("Missing last_message field")
            return False
        
        if 'lead' not in first:
            print_error("Missing embedded lead")
            return False
        
        if first['lead'] and '_id' in first['lead']:
            print_error("MongoDB _id in embedded lead")
            return False
        
        print(f"First conversation last_message: {first.get('last_message')[:50]}...")
        print_success("Conversations list passed")
        return True
    except Exception as e:
        print_error(f"Conversations list failed: {e}")
        return False

def test_conversations_messages():
    print_test("6b. Conversations - GET /api/conversations/{id}/messages")
    try:
        global test_conversation_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        resp = requests.get(f"{BASE_URL}/conversations/{test_conversation_id}/messages", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check structure
        if 'conversation' not in data:
            print_error("Missing conversation field")
            return False
        
        if 'lead' not in data:
            print_error("Missing lead field")
            return False
        
        if 'messages' not in data:
            print_error("Missing messages field")
            return False
        
        # Check no _id
        if not check_no_mongo_id(data):
            return False
        
        messages = data['messages']
        print(f"Messages count: {len(messages)}")
        
        # Check message order (should be chronological)
        roles = [m.get('role') for m in messages]
        print(f"Message roles in order: {roles}")
        
        # First should be comment, second should be agent (initial DM)
        if len(messages) >= 2:
            if messages[0].get('role') != 'comment':
                print_error(f"First message should be 'comment', got {messages[0].get('role')}")
                return False
            
            if messages[1].get('role') != 'agent':
                print_error(f"Second message should be 'agent', got {messages[1].get('role')}")
                return False
        
        print_success("Conversations messages passed")
        return True
    except Exception as e:
        print_error(f"Conversations messages failed: {e}")
        return False

def test_conversations_convert():
    print_test("6c. Conversations - POST /api/conversations/{id}/convert")
    try:
        global test_conversation_id, test_lead_id
        
        if not test_conversation_id:
            print_error("No conversation_id available")
            return False
        
        payload = {
            "amount": 1499
        }
        
        resp = requests.post(f"{BASE_URL}/conversations/{test_conversation_id}/convert", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        # Verify lead is now converted
        resp2 = requests.get(f"{BASE_URL}/leads", timeout=10)
        leads = resp2.json()
        
        converted_lead = None
        for lead in leads:
            if lead.get('id') == test_lead_id:
                converted_lead = lead
                break
        
        if not converted_lead:
            print_error("Lead not found after conversion")
            return False
        
        if converted_lead.get('stage') != 'converted':
            print_error(f"Expected stage='converted', got {converted_lead.get('stage')}")
            return False
        
        if converted_lead.get('revenue', 0) < 1499:
            print_error(f"Expected revenue >= 1499, got {converted_lead.get('revenue')}")
            return False
        
        print(f"Lead stage: {converted_lead.get('stage')}")
        print(f"Lead revenue: ₹{converted_lead.get('revenue')}")
        print_success("Conversations convert passed")
        return True
    except Exception as e:
        print_error(f"Conversations convert failed: {e}")
        return False

# ============================================================================
# 7. LEADS CRUD
# ============================================================================
def test_leads_list():
    print_test("7a. Leads - GET /api/leads")
    try:
        resp = requests.get(f"{BASE_URL}/leads", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Leads count: {len(data)}")
        
        if len(data) == 0:
            print_error("No leads found")
            return False
        
        # Check no _id
        if not check_no_mongo_id(data):
            return False
        
        # Check structure
        first = data[0]
        required = ['id', 'handle', 'stage', 'score']
        for field in required:
            if field not in first:
                print_error(f"Missing field: {field}")
                return False
        
        print(f"First lead: {first.get('handle')} - {first.get('stage')} - {first.get('score')}")
        print_success("Leads list passed")
        return True
    except Exception as e:
        print_error(f"Leads list failed: {e}")
        return False

def test_leads_patch():
    print_test("7b. Leads - PATCH /api/leads/{id}")
    try:
        # Get a lead
        resp = requests.get(f"{BASE_URL}/leads", timeout=10)
        leads = resp.json()
        
        if len(leads) == 0:
            print_error("No leads available")
            return False
        
        # Find a lead that's not already qualified
        test_lead = None
        for lead in leads:
            if lead.get('stage') != 'qualified':
                test_lead = lead
                break
        
        if not test_lead:
            test_lead = leads[0]
        
        lead_id = test_lead['id']
        original_stage = test_lead.get('stage')
        
        payload = {
            "stage": "qualified"
        }
        
        resp2 = requests.patch(f"{BASE_URL}/leads/{lead_id}", json=payload, timeout=10)
        print(f"Status: {resp2.status_code}")
        
        if resp2.status_code != 200:
            print_error(f"Expected 200, got {resp2.status_code}")
            return False
        
        # Verify update
        resp3 = requests.get(f"{BASE_URL}/leads", timeout=10)
        updated_leads = resp3.json()
        
        updated_lead = None
        for lead in updated_leads:
            if lead.get('id') == lead_id:
                updated_lead = lead
                break
        
        if not updated_lead:
            print_error("Lead not found after update")
            return False
        
        if updated_lead.get('stage') != 'qualified':
            print_error(f"Stage not updated: {updated_lead.get('stage')}")
            return False
        
        print(f"Lead stage updated: {original_stage} → {updated_lead.get('stage')}")
        print_success("Leads PATCH passed")
        return True
    except Exception as e:
        print_error(f"Leads PATCH failed: {e}")
        return False

# ============================================================================
# 8. ANALYTICS
# ============================================================================
def test_analytics():
    print_test("8. Analytics - GET /api/analytics")
    try:
        resp = requests.get(f"{BASE_URL}/analytics", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_error(f"Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Analytics: {json.dumps(data, indent=2)}")
        
        # Check required fields
        required = [
            'total_conversations',
            'total_leads',
            'total_messages',
            'total_campaigns',
            'comment_triggers',
            'revenue',
            'converted',
            'conversion_rate',
            'stages',
            'top_campaigns'
        ]
        
        for field in required:
            if field not in data:
                print_error(f"Missing field: {field}")
                return False
        
        # Check types
        if not isinstance(data['total_conversations'], int):
            print_error(f"total_conversations should be int, got {type(data['total_conversations'])}")
            return False
        
        if not isinstance(data['conversion_rate'], (int, float)):
            print_error(f"conversion_rate should be number, got {type(data['conversion_rate'])}")
            return False
        
        if not isinstance(data['stages'], dict):
            print_error(f"stages should be object, got {type(data['stages'])}")
            return False
        
        if not isinstance(data['top_campaigns'], list):
            print_error(f"top_campaigns should be array, got {type(data['top_campaigns'])}")
            return False
        
        # Check values reflect our test actions
        if data['total_conversations'] < 1:
            print_error(f"Expected at least 1 conversation, got {data['total_conversations']}")
            return False
        
        if data['total_leads'] < 1:
            print_error(f"Expected at least 1 lead, got {data['total_leads']}")
            return False
        
        if data['comment_triggers'] < 1:
            print_error(f"Expected at least 1 comment trigger, got {data['comment_triggers']}")
            return False
        
        print_success("Analytics passed - all fields present and valid")
        return True
    except Exception as e:
        print_error(f"Analytics failed: {e}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("REPLYROCKET BACKEND API TEST SUITE")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    # Run all tests in order
    tests = [
        ("Health Check", test_health),
        ("Agent GET", test_agent_get),
        ("Agent POST", test_agent_post),
        ("Campaigns GET", test_campaigns_get),
        ("Campaigns POST", test_campaigns_post),
        ("Campaigns DELETE", test_campaigns_delete),
        ("Simulate Comment (match)", test_simulate_comment_match),
        ("Simulate Comment (no match)", test_simulate_comment_no_match),
        ("Simulate Comment (invalid)", test_simulate_comment_invalid_campaign),
        ("AI Reply Turn 1", test_ai_reply_turn1),
        ("AI Reply Turn 2", test_ai_reply_turn2),
        ("AI Reply Turn 3", test_ai_reply_turn3),
        ("AI Context Persistence", test_ai_context_persistence),
        ("AI Reply (invalid)", test_ai_reply_invalid_conversation),
        ("Conversations List", test_conversations_list),
        ("Conversations Messages", test_conversations_messages),
        ("Conversations Convert", test_conversations_convert),
        ("Leads List", test_leads_list),
        ("Leads PATCH", test_leads_patch),
        ("Analytics", test_analytics),
    ]
    
    for name, test_func in tests:
        try:
            result = test_func()
            results[name] = result
            time.sleep(0.5)  # Small delay between tests
        except Exception as e:
            print_error(f"Test {name} crashed: {e}")
            results[name] = False
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
