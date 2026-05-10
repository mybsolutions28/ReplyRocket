#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  ReplyRocket — AI Revenue Engine for Social Creators.
  MVP focuses on the AI Auto-Closer flow: Instagram comment → auto DM → AI sales conversation
  → booking/payment links → CRM lead progression → analytics.
  Real Instagram OAuth is intentionally simulated via "IG Simulator" page for MVP.

backend:
  - task: "AI Agent CRUD (training profile)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/agent (creates seeded Pawsome Pet Salon agent if absent), POST /api/agent upserts business_name, persona, tone, language, services, faqs, booking_link, upi_id."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - GET /api/agent returns seed Pawsome Pet Salon profile with all required fields (services, faqs, booking_link, upi_id). No _id leakage. POST /api/agent successfully updates business_name and persists changes. Verified with re-GET."

  - task: "Campaigns CRUD"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET/POST/DELETE /api/campaigns. Auto-seeds 2 demo campaigns (PRICE, SHOOT) on first load. Stores keyword (uppercase), dm_template with {{handle}} placeholder, post_caption, post_image_url."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - GET /api/campaigns returns 2 seeded campaigns (PRICE, SHOOT). POST /api/campaigns with keyword='buy' creates campaign with normalized keyword='BUY'. DELETE /api/campaigns/{id} removes campaign (verified with GET). No _id leakage."

  - task: "Comment-to-DM Simulator endpoint"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/simulate-comment {campaign_id, commenter_handle, comment_text}. Matches keyword case-insensitive, creates lead+conversation+initial DM message, increments campaign.stats.triggers. Returns matched=false with message if keyword absent."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - POST /api/simulate-comment with matching keyword 'PRICE' returns matched=true, creates lead_id, conversation_id, and dm_text with {{handle}} replaced correctly. Non-matching comment returns matched=false with no lead/convo created. Invalid campaign_id returns 404 with error field."

  - task: "AI Auto-Closer reply (Claude Sonnet 4.5)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/conversations/:id/reply — appends user message, calls Claude Sonnet 4.5 via Emergent OpenAI-compatible endpoint with response_format=json_object. AI returns {reply, intent, lead_score, lead_stage, actions[]}. Backend enriches share_payment_link with mock rzp.io link, share_booking_link with agent.booking_link. Updates lead.stage/score and conversation.last_message. Manual smoke test passed end-to-end."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - POST /api/conversations/{id}/reply works correctly across 3 turns. Turn 1 (pricing inquiry) returns intent, lead_score, lead_stage, actions array with valid types. Turn 2 (booking request) returns share_booking_link action with url=https://cal.com/pawsome/book. Turn 3 (payment request) returns share_payment_link action with enriched link object {url:'https://rzp.io/i/...', amount, label}. Multi-turn context maintained (Golden Retriever mentioned across turns). Invalid conversation_id returns 404. FIXED BUG: ai_meta was returning original parsed actions instead of enrichedActions - changed line 453 to return { ...parsed, actions: enrichedActions }."

  - task: "Conversations & Messages list/detail"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/conversations (with embedded lead), GET /api/conversations/:id/messages (sets unread=0), POST /api/conversations/:id/convert (manual conversion logging revenue)."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - GET /api/conversations returns list with last_message and embedded lead (no _id). GET /api/conversations/{id}/messages returns conversation, lead, messages array in chronological order (comment, agent, user, agent...). POST /api/conversations/{id}/convert with amount=1499 updates lead to stage='converted' and revenue>=1499."

  - task: "Leads (CRM) list + stage update"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/leads, PATCH /api/leads/:id {stage,score}."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - GET /api/leads returns array with no _id leakage. PATCH /api/leads/{id} with stage='qualified' updates lead stage successfully (verified with GET)."

  - task: "Analytics aggregation"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/analytics returns total_conversations, total_leads, total_messages, total_campaigns, comment_triggers, revenue, converted, conversion_rate, stages map, top_campaigns."
        - working: true
          agent: "testing"
          comment: "✅ PASSED - GET /api/analytics returns all required fields with correct types: total_conversations (int), total_leads (int), total_messages (int), total_campaigns (int), comment_triggers (int), revenue (number), converted (int), conversion_rate (number 0-100), stages (object), top_campaigns (array). Values reflect test actions correctly."

frontend:
  - task: "Dashboard hero + analytics + pipeline"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Manually screenshot-verified renders correctly with violet/fuchsia gradient hero and 4 stat cards."

  - task: "AI Agent Trainer page"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Campaigns CRUD UI"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Instagram Simulator UI"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Inbox + AI chat with action chips"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Leads CRM table"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "AI Agent CRUD (training profile)"
    - "Campaigns CRUD"
    - "Comment-to-DM Simulator endpoint"
    - "AI Auto-Closer reply (Claude Sonnet 4.5)"
    - "Conversations & Messages list/detail"
    - "Analytics aggregation"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Built ReplyRocket MVP focused on the AI Auto-Closer aha-moment flow.
        Tech: Next.js 14 app router + MongoDB + Claude Sonnet 4.5 via Emergent Universal Key (OpenAI-compatible endpoint at https://integrations.emergentagent.com/llm/v1).

        End-to-end flow: simulate Instagram comment → keyword match → fire personalized DM →
        AI sales agent qualifies & closes (booking link / mock Razorpay pay link) → lead stage auto-progresses → analytics roll up.

        Smoke-tested manually via curl: comment "PRICE please" → AI replied with Full Spa recommendation → booking link → ₹1499 payment link generation. All structured JSON parsing worked.

        Please test all backend endpoints listed in test_plan. Key scenarios:
        1. GET /api/agent returns seed agent on first call; POST /api/agent upserts.
        2. GET /api/campaigns auto-seeds 2 campaigns; POST creates new with normalized keyword; DELETE removes.
        3. POST /api/simulate-comment with matching keyword creates lead+convo+initial DM; non-matching returns matched=false.
        4. POST /api/conversations/{id}/reply produces an AI response, stores user+agent messages, and returns ai_meta with intent/lead_score/lead_stage/actions. Verify share_payment_link enriched with mock rzp.io link and share_booking_link enriched with agent.booking_link.
        5. PATCH /api/leads/{id} updates stage. POST /api/conversations/{id}/convert increments revenue.
        6. GET /api/analytics aggregates correctly.

        DB name: 'replyrocket' (from .env DB_NAME). Workspace fixed to "default".

    - agent: "testing"
      message: |
        ✅ ALL BACKEND TESTS PASSED (20/20)
        
        Comprehensive testing completed for all backend endpoints at https://funnel-ai-hub.preview.emergentagent.com/api
        
        Test Results Summary:
        1. ✅ Health Check - Returns {ok:true, app:'ReplyRocket', model:'claude-sonnet-4-5'}
        2. ✅ AI Agent CRUD - GET returns seed Pawsome Pet Salon profile, POST updates and persists
        3. ✅ Campaigns CRUD - GET returns 2 seeded campaigns, POST creates with normalized keyword, DELETE removes
        4. ✅ Comment-to-DM Simulator - Matching keyword creates lead+convo+DM, non-matching returns matched=false, invalid campaign returns 404
        5. ✅ AI Auto-Closer Reply - Multi-turn conversation works correctly with context persistence, actions enriched properly
        6. ✅ Conversations - List with embedded lead, messages in order, convert updates lead stage/revenue
        7. ✅ Leads - List returns array, PATCH updates stage
        8. ✅ Analytics - All fields present with correct types and values
        
        BUG FIXED: Found and fixed critical issue in /api/conversations/:id/reply endpoint (line 453). The ai_meta was returning original parsed actions instead of enrichedActions. Changed from `ai_meta: parsed` to `ai_meta: { ...parsed, actions: enrichedActions }`. This ensures booking links and payment links are properly enriched with url/link fields.
        
        Edge cases tested:
        - Invalid campaign_id → 404 with error
        - Invalid conversation_id → 404 with error
        - No MongoDB ObjectId (_id) leakage anywhere
        - {{handle}} placeholder replacement works correctly
        - Multi-turn AI context maintained (Golden Retriever mentioned across 3 turns)
        
        All backend APIs are production-ready. No major issues found.
