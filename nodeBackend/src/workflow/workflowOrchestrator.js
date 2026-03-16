class WorkflowOrchestrator {
  constructor({ pipelineEngine }) {
    this.pipelineEngine = pipelineEngine;
  }

  async run(input) {
    return this.pipelineEngine.execute(input);
  }
}

module.exports = { WorkflowOrchestrator };
