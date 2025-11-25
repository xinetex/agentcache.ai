# Testing Checklist - HPC Sector Integration

**Date:** November 25, 2025  
**Server:** http://localhost:3000

---

## ✅ Phase 1: Wizard UI Testing

### Test 1: Wizard Opens Correctly
- [ ] Navigate to http://localhost:3000
- [ ] Click "AI Pipeline Wizard" button
- [ ] Wizard modal appears with polished UI
- [ ] Header shows gradient icon and step indicator

### Test 2: Sector Selection Works
- [ ] Select different sectors (Healthcare, Finance, Education)
- [ ] Sector modal closes
- [ ] Wizard reopens with sector context

### Test 3: HPC Scenarios Display
**Healthcare Sector:**
- [ ] See "HIPAA-Compliant RAG" scenario
- [ ] See "Diagnostic Imaging Analysis" scenario
- [ ] See "Patient Triage Assistant" scenario
- [ ] Each shows: compliance badges (🔒 HIPAA), estimated savings ($3,200/mo)
- [ ] Complexity badges show correctly (Enterprise, etc.)

**Finance Sector:**
- [ ] See "Real-Time Fraud Detection"
- [ ] See "KYC Document Verification"
- [ ] See "Market Sentiment Analysis"
- [ ] PCI-DSS compliance badges visible

**Education Sector:**
- [ ] See "Science of Reading RAG"
- [ ] See "AI Tutoring Personalization"
- [ ] See "Automated Essay Grading"
- [ ] FERPA/COPPA badges visible

### Test 4: Scenario Selection
- [ ] Click a scenario card
- [ ] Card highlights with blue border
- [ ] Selection indicator (radio dot) appears
- [ ] Can switch between scenarios
- [ ] "Next" button is enabled

### Test 5: Custom Option
- [ ] Select "Custom" use case (if visible)
- [ ] Text area appears
- [ ] Example chips display (📊 Data Lakehouse RAG, etc.)
- [ ] Clicking chip fills textarea
- [ ] Can type custom text

### Test 6: Performance Selection (Step 2)
- [ ] Click "Next" after selecting scenario
- [ ] Performance options screen appears
- [ ] See: ⚡ Low Latency, ⚖️ Balanced, 💰 Cost Optimized
- [ ] Can select different options
- [ ] Selection highlights correctly

### Test 7: Pipeline Generation (Step 3)
- [ ] Click "Generate Pipeline"
- [ ] Loading spinner appears
- [ ] "AI is generating your pipeline..." message shows
- [ ] Pipeline appears in workspace after ~2 seconds
- [ ] Nodes are correctly positioned
- [ ] Edges connect nodes sequentially

---

## ✅ Phase 2: Pipeline Testing

### Test 8: Generated Pipeline Structure
**For Healthcare HIPAA RAG:**
- [ ] See nodes: L1 Cache, L2 Redis, Compliance Layer, PII Detection, Semantic Dedup
- [ ] Each node has correct label
- [ ] Nodes are connected with animated edges
- [ ] Can click nodes to see details

### Test 9: Pipeline Metadata
- [ ] Pipeline name matches scenario (e.g., "HIPAA-Compliant RAG")
- [ ] Description is visible
- [ ] Estimated savings displayed
- [ ] Complexity tier shown

### Test 10: Save Pipeline
- [ ] Can save generated pipeline
- [ ] Pipeline appears in dashboard
- [ ] Metadata is preserved (compliance, savings)

---

## ✅ Phase 3: UI/UX Quality

### Test 11: Visual Polish
- [ ] Wizard has smooth animations (fade in, slide up)
- [ ] Step transitions are smooth
- [ ] Loading spinner is centered and animated
- [ ] No layout shifts or flashing
- [ ] Colors match design (blue primary, dark background)

### Test 12: Responsive Design
- [ ] Resize browser to tablet size (768px)
- [ ] Cards stack to 1 column
- [ ] Footer buttons stack vertically
- [ ] All text remains readable
- [ ] No horizontal scroll

### Test 13: Error Handling
- [ ] Try clicking "Next" without selecting scenario → Error message appears
- [ ] Error message is readable and helpful
- [ ] Can recover from error state

---

## ✅ Phase 4: Integration Testing

### Test 14: Sector Scenarios Load
- [ ] Open browser console (F12)
- [ ] No errors related to `getSectorScenarios`
- [ ] No 404s for scenario data
- [ ] All images/icons load correctly

### Test 15: Database Connection
- [ ] Check server logs for database connection
- [ ] Edge locations loaded (20 rows)
- [ ] No migration errors

---

## 🐛 Bug Report Template

If you find issues, document them here:

```
Bug: [Brief description]
Steps to Reproduce:
1. 
2. 
3. 

Expected: [What should happen]
Actual: [What actually happened]
Severity: [Low/Medium/High/Critical]
Screenshot: [If applicable]
```

---

## ✅ Checklist Results

**Total Tests:** 15  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___  

**Overall Status:** [ ] PASS | [ ] FAIL | [ ] NEEDS WORK

---

## 📝 Notes

Add any observations, suggestions, or issues here:

```
[Your notes]
```

---

## 🎯 Next Steps Based on Results

**If ALL tests pass:**
→ Move to Phase 2 (Interactive Landing Page)

**If 1-3 minor issues:**
→ Fix bugs, then move to Phase 2

**If 4+ issues or critical bugs:**
→ Debug and retest before proceeding

---

**Ready to test! Open http://localhost:3000 and work through this checklist.** ✅
