import os
import sys
import sympy as sp
from flask import Flask, jsonify, render_template, request

# Create Flask app
app = Flask(__name__, template_folder='templates', static_folder='static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/solve')
def solve_ode():
    try:
        # Get cooling parameters from query string (or use defaults)
        t_0_val = float(request.args.get('T0', 80))
        t_m_val = float(request.args.get('Tm', 20))
        k_val = float(request.args.get('k', 0.05))
        
        # 1. SymPy symbolic resolution
        t = sp.Symbol('t', real=True, positive=True)
        T = sp.Function('T')(t)
        k, Tm, T0 = sp.symbols('k T_m T_0', real=True, positive=True)
        
        # Equation: dT/dt = -k*(T(t) - Tm)
        ode = sp.Eq(T.diff(t), -k * (T - Tm))
        
        # General solution
        general_sol = sp.dsolve(ode, T)
        
        # Particular solution with T(0) = T0
        particular_sol = sp.dsolve(ode, T, ics={T.subs(t, 0): T0})
        
        # Format equations nicely to LaTeX
        ode_latex = sp.latex(ode)
        gen_sol_latex = sp.latex(general_sol)
        part_sol_latex = sp.latex(particular_sol)
        
        # Step-by-step math presentation text (LaTeX markup)
        steps = {
            "model_ode": f"\\frac{{dT}}{{dt}} = -k(T - T_m)",
            "separable": f"\\frac{{dT}}{{T - T_m}} = -k \\, dt",
            "integrated": f"\\int \\frac{{dT}}{{T - T_m}} = \\int -k \\, dt \\implies \\ln|T - T_m| = -kt + C",
            "exponentiated": f"T(t) - T_m = C_1 e^{{-kt}} \\quad \\text{{donde }} C_1 = \\pm e^C",
            "general_solution": f"T(t) = T_m + C_1 e^{{-kt}}",
            "initial_condition": f"T(0) = T_0 \\implies T_0 = T_m + C_1 \\implies C_1 = T_0 - T_m",
            "particular_solution": f"T(t) = T_m + (T_0 - T_m) e^{{-kt}}"
        }
        
        # Generate the Python code snippet used to solve it symbolically
        python_snippet = (
            "import sympy as sp\n\n"
            "# 1. Definir variables simbólicas\n"
            "t = sp.Symbol('t', real=True, positive=True)\n"
            "T = sp.Function('T')(t)\n"
            "k, Tm, T0 = sp.symbols('k T_m T_0', real=True, positive=True)\n\n"
            "# 2. Plantear la ecuación diferencial (Ley de Enfriamiento de Newton)\n"
            "ode = sp.Eq(T.diff(t), -k * (T - Tm))\n\n"
            "# 3. Resolver simbólicamente con condición inicial T(0) = T0\n"
            "solucion = sp.dsolve(ode, T, ics={T.subs(t, 0): T0})\n"
            "print(sp.latex(solucion))"
        )

        return jsonify({
            "success": True,
            "ode_latex": ode_latex,
            "gen_sol_latex": gen_sol_latex,
            "part_sol_latex": part_sol_latex,
            "particular_sol_eval": f"T(t) = {t_m_val} + ({t_0_val} - {t_m_val}) e^{{-{k_val} t}}",
            "steps": steps,
            "python_snippet": python_snippet,
            "params": {
                "T0": t_0_val,
                "Tm": t_m_val,
                "k": k_val
            }
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400

if __name__ == '__main__':
    # Run server on port 5000
    print("Servidor de simulación de enfriamiento iniciando en http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
