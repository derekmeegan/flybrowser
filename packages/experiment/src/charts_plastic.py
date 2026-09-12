"""Scientific charts for the internal-connection experiment."""
import json,csv
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter
from matplotlib import font_manager
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';P=OUT/'plastic'
font_manager.fontManager.addfont(OUT/'fonts/Inter.ttf')
plt.rcParams.update({'font.family':'Inter','font.size':13,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#D8D2CF','text.color':'#100D0D','axes.labelcolor':'#514F4F','xtick.color':'#514F4F','ytick.color':'#514F4F','figure.facecolor':'#F9F6F4','axes.facecolor':'#F9F6F4','savefig.facecolor':'#F9F6F4'})
summary=json.loads((P/'evaluation_summary.json').read_text())['summary']
def wilson(k,n):
 z=1.96;p=k/n;center=(p+z*z/(2*n))/(1+z*z/n);half=z*np.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
 return max(0,center-half),min(1,center+half)
names=['Random\nactions','Before\ntraining','Trained internal\nconnections','Reset learned\nconnections','Shuffled wiring\n+ training']
colors=['#C1B9B4','#A49B96','#F03603','#A49B96','#4DA9E4']
fig,ax=plt.subplots(figsize=(13.6,7.6),layout='constrained')
rates=[r['success_rate'] for r in summary];intervals=[wilson(r['successes'],r['n']) for r in summary]
ax.bar(range(5),rates,color=colors,width=.58,zorder=3)
ax.errorbar(range(5),rates,yerr=[[p-a for p,(a,b) in zip(rates,intervals)],[b-p for p,(a,b) in zip(rates,intervals)]],fmt='none',ecolor='#100D0D',capsize=5,lw=1.4,zorder=4)
for i,r in enumerate(summary):ax.text(i,max(.06,r['success_rate']+.055),f"{r['successes']}/{r['n']}",ha='center',fontweight='bold',fontsize=18)
ax.set_ylim(0,1.22);ax.set_yticks([0,.25,.5,.75,1]);ax.yaxis.set_major_formatter(PercentFormatter(1));ax.set_xticks(range(5),names);ax.grid(axis='y',color='#E4DEDA',zorder=0);ax.set_ylabel('Three-step browser task success')
ax.set_title('Training internal connections improved browser performance.',loc='left',fontsize=21,fontweight='bold',pad=24)
fig.supxlabel('200 fresh episode seeds per condition · new two-column layout · 95% Wilson intervals\nFixed vocabulary; one model configuration. Shuffled wiring also learned: no anatomical advantage demonstrated.',fontsize=11,color='#514F4F')
fig.savefig(OUT/'performance.png',dpi=160);fig.savefig(OUT/'performance.svg');plt.close(fig)
fig,axes=plt.subplots(1,2,figsize=(14,6.8),layout='constrained')
for cond,col,name in [('connectome','#F03603','Measured wiring'),('shuffled','#4DA9E4','Shuffled wiring')]:
 rows=json.loads((P/f'{cond}-history.json').read_text())
 for ax,key in zip(axes,['decision_accuracy','reward_mse']):
  ax.plot([r['step'] for r in rows],[r[key] for r in rows],label=name,color=col,lw=2.8)
axes[0].set_ylim(0,1.06);axes[0].yaxis.set_major_formatter(PercentFormatter(1));axes[0].set_title('Fixed-vocabulary decision diagnostic',loc='left',fontweight='bold',pad=18)
axes[1].set_title('Chosen-action reward prediction loss',loc='left',fontweight='bold',pad=18);axes[1].set_ylabel('MSE weighted by logged sample counts')
for ax in axes:ax.grid(color='#E4DEDA');ax.set_xlabel('Gradient updates on internal connection gains');ax.set_xlim(0,300)
axes[0].legend(loc='lower right',frameon=False,fontsize=11)
fig.supxlabel('Development diagnostics, not held-out generalization: 12 cue decisions / 48 cue–candidate stimuli.\nEach update reuses the same 1,200 browser rewards. Only 61,210 existing KC → MBON gains train; interfaces stay fixed.',fontsize=10.5,color='#514F4F')
fig.savefig(OUT/'learning-curve.png',dpi=160);fig.savefig(OUT/'learning-curve.svg');plt.close(fig)
with (OUT/'results.csv').open('w') as f:
 writer=csv.DictWriter(f,fieldnames=list(summary[0])+['ci95_low','ci95_high']);writer.writeheader()
 for row,(lo,hi) in zip(summary,intervals):writer.writerow({**row,'ci95_low':lo,'ci95_high':hi})
print('Saved primary experiment charts and results.csv')
