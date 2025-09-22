# Flutter 项目架构说明

## 📁 **lib/ 文件夹结构与职责**

```
lib/
├── main.dart                 # 🚀 应用入口点
├── models/                   # 📊 数据模型层
├── services/                 # 🔗 业务逻辑与通信层
├── providers/               # 🧠 状态管理层
├── screens/                 # 📱 页面/屏幕层
└── widgets/                 # 🧩 可复用UI组件层
```

---

## 🏗️ **详细架构说明**

### 1. **📊 models/ - 数据模型层**
> **职责**: 定义数据结构和数据转换逻辑

```dart
models/
├── device.dart              # 设备数据模型
├── preset.dart              # 预设数据模型  
├── user.dart                # 用户数据模型
└── models.dart              # 统一导出文件
```

**功能特点**:
- ✅ **数据结构定义**: Device, Preset, User, EQSettings
- ✅ **JSON序列化**: toJson() / fromJson()
- ✅ **前后端转换**: toBackend() / fromBackend()
- ✅ **数据验证**: 字段校验和默认值
- ✅ **业务逻辑**: copyWith(), 便利方法等

---

### 2. **🔗 services/ - 业务逻辑与通信层**
> **职责**: 处理数据持久化、网络通信和业务逻辑

```dart
services/
├── api_service.dart         # HTTP API通信服务
├── auth_service.dart        # 身份认证服务
├── device_service.dart      # 设备管理服务
└── preset_service.dart      # 预设管理服务
```

**功能特点**:
- 🌐 **网络通信**: REST API调用 (ApiService)
- 💾 **数据持久化**: 本地存储 (SharedPreferences)
- 🔐 **身份认证**: 登录/注册/Token管理
- 🔄 **数据同步**: 本地缓存 + 云端同步
- 📡 **业务逻辑**: 设备控制、预设应用等

---

### 3. **🧠 providers/ - 状态管理层**
> **职责**: 管理应用状态，连接UI和服务层

```dart
providers/
├── auth_provider.dart       # 认证状态管理
├── device_provider.dart     # 设备状态管理
└── preset_provider.dart     # 预设状态管理
```

**功能特点**:
- 📊 **状态管理**: 使用Provider模式
- 🔄 **数据流控制**: 连接服务层和UI层
- 📢 **变更通知**: notifyListeners()
- 🎯 **UI响应**: Consumer/Selector更新UI
- ⚡ **性能优化**: 避免不必要的重建

---

### 4. **📱 screens/ - 页面/屏幕层**
> **职责**: 完整的页面实现，组合各种组件

```dart
screens/
├── home_screen.dart         # 🏠 主页面
├── device_control_screen.dart # 🎛️ 设备控制页面
├── preset_screen.dart       # 🎵 预设管理页面
└── login_screen.dart        # 🔐 登录页面
```

**功能特点**:
- 📱 **完整页面**: Scaffold + AppBar + Body
- 🎨 **页面布局**: 组织和排列UI组件
- 🔄 **状态消费**: Consumer<Provider>
- 🧭 **导航逻辑**: 页面跳转和参数传递
- 💬 **用户交互**: 对话框、提示信息等

---

### 5. **🧩 widgets/ - 可复用UI组件层**
> **职责**: 封装可复用的UI组件

```dart
widgets/
├── volume_slider.dart       # 🔊 音量滑块组件
├── eq_slider.dart           # 🎛️ EQ调节组件
└── preset_selector.dart     # 🎵 预设选择器组件
```

**功能特点**:
- 🔄 **可复用**: 在多个页面中使用
- 🎨 **UI封装**: 专门的UI逻辑和样式
- 📊 **数据绑定**: 接收参数和回调
- ⚡ **性能优化**: StatelessWidget优先
- 🎯 **单一职责**: 每个组件专注一个功能

---

## 🔄 **数据流架构**

```
┌─────────────┐    用户操作    ┌─────────────┐
│   Screens   │ ────────────▶ │  Providers  │
│   (UI层)    │               │  (状态层)   │
└─────────────┘               └─────────────┘
       ▲                             │
       │ 状态更新                     │ 业务调用
       │                             ▼
┌─────────────┐               ┌─────────────┐
│   Widgets   │               │  Services   │
│  (组件层)   │               │  (服务层)   │
└─────────────┘               └─────────────┘
                                      │
                               数据交换 │
                                      ▼
                              ┌─────────────┐
                              │   Models    │
                              │  (数据层)   │
                              └─────────────┘
```

---

## 🎯 **各层交互规则**

### ✅ **允许的依赖关系**:
- `Screens` → `Providers` → `Services` → `Models`
- `Widgets` → `Providers` → `Services` → `Models`
- `Services` ↔ `Services` (相互调用)

### ❌ **禁止的依赖关系**:
- `Models` → 任何其他层
- `Services` → `Providers`
- `Services` → `UI层`

---

## 📋 **文件命名规范**

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| **Screen** | `*_screen.dart` | `device_control_screen.dart` |
| **Widget** | `*_widget.dart` 或描述性名称 | `volume_slider.dart` |
| **Provider** | `*_provider.dart` | `device_provider.dart` |
| **Service** | `*_service.dart` | `api_service.dart` |
| **Model** | 描述性名称 | `device.dart`, `preset.dart` |

---

## 🚀 **扩展指南**

### 添加新功能时的步骤:
1. **📊 Model**: 先定义数据结构
2. **🔗 Service**: 实现业务逻辑和数据操作  
3. **🧠 Provider**: 管理状态变化
4. **🧩 Widget**: 创建专用UI组件
5. **📱 Screen**: 组合成完整页面

### 最佳实践:
- 🎯 **单一职责**: 每个文件专注一个功能
- 🔄 **松耦合**: 通过接口而非实现交互
- ⚡ **性能优先**: 避免不必要的重建和网络调用
- 📝 **可测试**: 逻辑与UI分离，便于单元测试

这种架构确保了代码的**可维护性**、**可扩展性**和**可测试性**！