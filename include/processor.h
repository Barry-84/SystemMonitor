#ifndef PROCESSOR_H
#define PROCESSOR_H

class Processor {
 public:
  float Utilization();  

 private:
    long prevActiveJiffies{0};
    long prevJiffies{0};
};

#endif