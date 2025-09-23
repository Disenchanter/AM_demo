import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "../providers/auth_provider.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController(); // 新增真实姓名控制器
  final _formKey = GlobalKey<FormState>();
  bool _isLoginMode = true; // true为登录模式，false为注册模式

  Future<void> _handleLogin() async {
    if (_formKey.currentState?.validate() ?? false) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      final success = await authProvider.login(
        _usernameController.text,
        _passwordController.text,
      );

      if (success && mounted) {
        Navigator.pushReplacementNamed(context, "/home");
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(authProvider.errorMessage)),
        );
      }
    }
  }

  Future<void> _handleRegister() async {
    if (_formKey.currentState?.validate() ?? false) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      final success = await authProvider.register(
        _usernameController.text,  // username (可选，显示名称)
        _emailController.text,     // email (必填，登录凭证)
        _passwordController.text,  // password
        _fullNameController.text,  // fullName (必填，真实姓名)
      );

      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("注册成功！请登录"),
            backgroundColor: Colors.green,
          ),
        );
        // 注册成功后切换到登录模式
        setState(() {
          _isLoginMode = true;
        });
        _clearForm();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _toggleMode() {
    setState(() {
      _isLoginMode = !_isLoginMode;
    });
    _clearForm();
  }

  void _clearForm() {
    _usernameController.clear();
    _emailController.clear();
    _passwordController.clear();
    _fullNameController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isLoginMode ? "登录" : "注册"),
        centerTitle: true,
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, child) {
          return Padding(
            padding: const EdgeInsets.all(16.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    "Audio Device Manager",
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 32),
                  
                  // 用户名输入框（注册模式：可选显示名称，登录模式：必填登录凭证）
                  TextFormField(
                    controller: _usernameController,
                    decoration: InputDecoration(
                      labelText: _isLoginMode ? "邮箱" : "用户名（可选）",
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.person),
                      helperText: _isLoginMode ? null : "显示名称，留空则使用邮箱前缀",
                    ),
                    validator: (value) {
                      if (_isLoginMode && (value == null || value.isEmpty)) {
                        return "请输入邮箱";
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // 邮箱输入框（仅注册模式显示）
                  if (!_isLoginMode) ...[
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(
                        labelText: "邮箱 *",
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.email),
                        helperText: "用作登录凭证",
                      ),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return "请输入邮箱";
                        }
                        if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                          return "请输入有效的邮箱地址";
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // 真实姓名输入框（仅注册模式显示）
                    TextFormField(
                      controller: _fullNameController,
                      decoration: const InputDecoration(
                        labelText: "真实姓名 *",
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.badge),
                        helperText: "用于账户身份识别",
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return "请输入真实姓名";
                        }
                        if (value.trim().length < 2) {
                          return "姓名至少需要2个字符";
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 密码输入框
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(
                      labelText: "密码",
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.lock),
                    ),
                    obscureText: true,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return "请输入密码";
                      }
                      if (!_isLoginMode && value.length < 8) {
                        return "密码至少需要8个字符";
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // 主要操作按钮（登录或注册）
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: authProvider.isLoading 
                          ? null 
                          : (_isLoginMode ? _handleLogin : _handleRegister),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: authProvider.isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text(
                              _isLoginMode ? "登录" : "注册",
                              style: const TextStyle(fontSize: 16),
                            ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 模式切换按钮
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _isLoginMode ? "还没有账户？" : "已有账户？",
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                      TextButton(
                        onPressed: _toggleMode,
                        child: Text(
                          _isLoginMode ? "立即注册" : "立即登录",
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
