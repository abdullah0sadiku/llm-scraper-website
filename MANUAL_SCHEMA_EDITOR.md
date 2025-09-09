# Manual Schema Editor Feature

## 🎉 New Feature: Manual JSON Schema Editor

The LLM Generator now includes a powerful manual JSON schema editor that allows users to edit schemas directly as JSON, giving them full control over complex schema structures.

## ✨ Features

### **Dual Mode Interface**
- **Visual Mode**: Traditional field-by-field builder (existing functionality)
- **JSON Mode**: Direct JSON editing with syntax highlighting and validation

### **Real-time Validation**
- Live JSON syntax validation
- Schema structure validation
- Visual error indicators with detailed messages
- Prevents invalid schemas from being saved

### **Seamless Synchronization**
- Changes in JSON mode sync back to visual builder
- Visual builder changes update JSON in real-time
- Bidirectional editing support

### **Professional Editor Experience**
- Syntax highlighting (dark theme)
- Line and character count
- Copy to clipboard functionality
- Error highlighting and tooltips
- Auto-formatting support

## 🚀 Business & Production Benefits

### **For Power Users**
- **Faster Schema Creation**: Copy-paste existing schemas from documentation
- **Complex Structures**: Create nested objects and arrays easily
- **Bulk Editing**: Modify multiple fields at once
- **Advanced Validation**: Add custom validation rules directly

### **For Developers**
- **API Integration**: Import schemas from OpenAPI specs
- **Version Control**: Easy to diff and track schema changes
- **Template Reuse**: Save and share schema templates
- **Debugging**: Inspect exact schema structure

### **For Business Users**
- **Flexibility**: No limitations of visual builder
- **Speed**: Experienced users can work faster
- **Precision**: Exact control over schema structure
- **Learning**: Visual mode helps understand JSON structure

## 📖 How to Use

### **Switching Modes**
1. Look for the **Visual/JSON** toggle in the Schema Editor section
2. Click **JSON** to switch to manual editing mode
3. Click **Visual** to return to the field builder

### **Manual Editing**
1. Switch to JSON mode
2. Edit the JSON schema directly in the text area
3. Real-time validation shows errors immediately
4. Valid schemas automatically sync to visual builder
5. Use **Copy** button to copy the final schema

### **Example Schemas**

#### Simple Object Schema
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "required": true,
      "description": "Full name"
    },
    "email": {
      "type": "string",
      "required": true,
      "description": "Email address"
    },
    "age": {
      "type": "number",
      "required": false,
      "description": "Age in years"
    }
  }
}
```

#### Array Schema with Complex Items
```json
{
  "type": "array",
  "items": {
    "title": {
      "type": "string",
      "required": true,
      "description": "Article title"
    },
    "content": {
      "type": "string",
      "required": true,
      "description": "Article content"
    },
    "tags": {
      "type": "array",
      "required": false,
      "description": "Article tags"
    },
    "metadata": {
      "type": "object",
      "required": false,
      "description": "Additional metadata"
    }
  }
}
```

#### Advanced Schema with Validation
```json
{
  "type": "object",
  "properties": {
    "product_name": {
      "type": "string",
      "required": true,
      "description": "Product name",
      "minLength": 3,
      "maxLength": 100
    },
    "price": {
      "type": "number",
      "required": true,
      "description": "Price in USD",
      "minimum": 0
    },
    "categories": {
      "type": "array",
      "required": false,
      "description": "Product categories"
    },
    "availability": {
      "type": "boolean",
      "required": true,
      "description": "Is product available"
    }
  }
}
```

## 🔧 Technical Implementation

### **Validation Rules**
- Must be valid JSON syntax
- Must have `type` property (`object` or `array`)
- Object schemas must have `properties`
- Array schemas must have `items`
- Field types must be valid (`string`, `number`, `boolean`, `array`, `object`)

### **Error Handling**
- Syntax errors prevent mode switching
- Invalid schemas show detailed error messages
- Graceful fallback to visual mode if JSON is corrupted
- Auto-recovery from temporary invalid states

### **Performance**
- Debounced validation to avoid excessive re-renders
- Efficient JSON parsing and validation
- Minimal re-renders when switching modes
- Optimized for large schemas

## 🎯 Use Cases

### **E-commerce Product Scraping**
```json
{
  "type": "array",
  "items": {
    "name": {"type": "string", "required": true},
    "price": {"type": "string", "required": true},
    "image_url": {"type": "string", "required": false},
    "description": {"type": "string", "required": false},
    "rating": {"type": "number", "required": false},
    "reviews_count": {"type": "number", "required": false},
    "availability": {"type": "boolean", "required": false}
  }
}
```

### **News Article Extraction**
```json
{
  "type": "array",
  "items": {
    "headline": {"type": "string", "required": true},
    "summary": {"type": "string", "required": false},
    "author": {"type": "string", "required": false},
    "published_date": {"type": "string", "required": false},
    "category": {"type": "string", "required": false},
    "tags": {"type": "array", "required": false},
    "word_count": {"type": "number", "required": false}
  }
}
```

### **Contact Information**
```json
{
  "type": "object",
  "properties": {
    "company_name": {"type": "string", "required": true},
    "address": {"type": "string", "required": false},
    "phone": {"type": "string", "required": false},
    "email": {"type": "string", "required": false},
    "website": {"type": "string", "required": false},
    "social_media": {"type": "object", "required": false}
  }
}
```

## 🚀 Getting Started

1. **Access the Feature**: Open any job creation or schema editing page
2. **Try JSON Mode**: Click the "JSON" tab in the Schema Editor section
3. **Start Simple**: Copy one of the example schemas above
4. **Experiment**: Modify the schema and see real-time validation
5. **Switch Back**: Use "Visual" mode to see how your JSON translates to fields

## 💡 Pro Tips

- Use the visual builder first to understand the JSON structure
- Copy existing schemas from API documentation
- Validate complex schemas in JSON mode before using
- Use the character/line count to optimize schema size
- Leverage the copy button for easy schema sharing

This feature makes the LLM Generator suitable for both beginners (visual mode) and power users (JSON mode), dramatically expanding its capabilities for complex data extraction scenarios! 🎉
