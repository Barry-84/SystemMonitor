#ifndef PROCESS_H
#define PROCESS_H

#include <string>
/*
Basic class for Process representation
It contains relevant attributes as shown below
*/
class Process {
 public:
  int Pid() const;                               
  std::string User();                     
  std::string Command();                   
  float CpuUtilization();                  
  std::string Ram();                       
  long int UpTime();                       
  bool operator<(Process const& a) const;  
  void setPID(int);
  float getCpuLoad() const;
  void CalcCpuLoad();

 private:
    int pid{0};
    float process_totaltime_old{0}, process_uptime_old{0};
    float cpu_load;
};

#endif