# Professional Grade Calculator Overhaul

## Context
The current calculator implementation has fundamental input validation and calculation issues that prevent it from meeting professional standards. The existing code uses a relaxed approach to input handling that allows mathematically invalid sequences and suffers from floating-point precision errors, UI overflow issues, and poor error recovery.

## Problem Summary
The calculator needs a complete overhaul to implement "Strict Input Guardrails" that:
1. Prevent invalid sequences from being entered
2. Fix floating-point precision errors
3. Protect the UI from overflow
4. Ensure parentheses balance
5. Provide robust error recovery

## Technical Approach

### Core Changes to calculator.js

#### 1. Enhanced Input Validation (appendValue function)
- **Guard Logic**: Completely rewrite `appendValue` to validate each character against the current expression state
- **Legal Starts**: Only allow `-` as first character (for negative numbers)
- **Operator Rules**: Prevent consecutive operators except for valid cases like `*-` or `/-`
- **Decimal Rules**: Allow only one decimal point per number
- **Parentheses Logic**: Allow opening/closing based on balance

#### 2. Floating Point Precision (evaluateExpression function)
- **Rounding**: Implement a rounding clamp to fix precision errors like 0.1 + 0.2
- **Precision Limit**: Round results to 10 decimal places
- **Safe Math**: Use precision-preserving calculations

#### 3. UI Protection (updateDisplay function)
- **Character Limit**: Add max length constraint (e.g., 50 chars) to prevent layout overflow
- **Display Logic**: Ensure long numbers don't break layout

#### 4. Parentheses Balance Validation
- **Pre-evaluation Check**: Verify matching parentheses before evaluation
- **Post-execution Logic**: Allow empty parentheses? (depends on desired behavior)

#### 5. Error Recovery System
- **Error State**: When "Error" is displayed, clear it on next input
- **Clean Slate**: Allow fresh start after error

#### 6. Security Enhancement
- **Current Status**: The code already uses `new Function()` which is safer than `eval()` but still could be improved with a proper tokenizer/parser for maximum security

### Implementation Strategy

#### Phase 1: Input Guardrails
- Rewrite `appendValue` with comprehensive validation
- Add helper functions for validation rules
- Implement decimal point tracking per number
- Add operator sequence validation

#### Phase 2: Precision & Error Handling
- Add rounding function for floating-point results
- Implement error state management
- Add parentheses balance checking

#### Phase 3: UI Protection
- Add character limits and overflow protection
- Update display logic to handle edge cases
- Implement graceful error recovery

#### Phase 4: Testing & Validation
- Test all invalid input scenarios
- Verify floating-point precision fixes
- Test UI overflow protection
- Validate parentheses balance checking

## Files to Modify

### Primary Files:
- `/d/website/calculator-website/js/calculator.js` - Main calculator logic (all functions)

### Supporting Files:
- `/d/website/calculator-website/css/style.css` - May need minor tweaks for display styling
- `/d/website/calculator-website/js/main.js` - Event handling (minimal changes if any)

## Verification

### Test Cases to Validate:
1. **Invalid Operator Sequences**:
   - `*/+`, `++`, `//` should be rejected
   - `5 * -2` should be allowed
   - `10 / 0` should show "Error"

2. **Decimal Point Validation**:
   - `5.5.5` should be rejected
   - `0.1 + 0.2` should equal 0.3 (not 0.30000000000000004)
   - `5.2 + 3` should work normally

3. **Start/End Validation**:
   - Starting with `*` or `/` should be rejected
   - `-5` should be allowed (negative number)

4. **Parentheses Balance**:
   - `(5 + 3)` should work
   - `(5 + 3` should be rejected or show error
   - `5 + (3 * 2))` should show error

5. **UI Overflow Protection**:
   - Very long numbers should be truncated or rejected
   - Display should remain stable

6. **Error Recovery**:
   - After "Error" is shown, next keypress should clear error
   - Fresh calculation should be possible

### Testing Approach:
1. Manual testing with various inputs
2. Check console for validation errors
3. Verify visual display behavior
4. Test edge cases and invalid sequences

## Timeline
This overhaul will require a complete rewrite of the core calculator logic but should maintain backward compatibility for valid use cases while preventing invalid ones.